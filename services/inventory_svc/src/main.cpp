#include <grpcpp/grpcpp.h>
#include "inventory.grpc.pb.h"
#include <pqxx/pqxx>
#include <sw/redis++/redis++.h>
#include <spdlog/spdlog.h>
#include <cstdlib>
#include <string>
#include <functional>

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;
namespace inv = omnistock::inventory::v1;

static std::string env_or(const char *key, const char *defv)
{
  const char *v = std::getenv(key);
  return v ? std::string(v) : std::string(defv);
}

// Simple RAII scope guard to ensure cleanup
struct ScopeGuard
{
  std::function<void()> fn;
  ~ScopeGuard()
  {
    if (fn)
      fn();
  }
};

class InventoryImpl final : public inv::InventoryService::Service
{
public:
  InventoryImpl(const std::string &pg_dsn, const std::string &redis_url)
      : pg_dsn_(pg_dsn), redis_(redis_url) {}

  Status GetStock(ServerContext *, const inv::StockQuery *req, inv::StockView *res) override
  {
    try
    {
      pqxx::connection c(pg_dsn_);
      pqxx::work tx{c};
      pqxx::result r = tx.exec_params(
          "select on_hand, reserved, (on_hand-reserved) as available "
          "from stock_items s join products p on p.id=s.product_id "
          "join tenants t on t.id=p.tenant_id "
          "where t.id=$1 and p.sku=$2 and s.location_code=$3",
          req->tenant_id(), req->sku(), req->location());
      if (!r.empty())
      {
        res->set_on_hand(r[0][0].as<long long>(0));
        res->set_reserved(r[0][1].as<long long>(0));
        res->set_available(r[0][2].as<long long>(0));
      }
      else
      {
        res->set_on_hand(0);
        res->set_reserved(0);
        res->set_available(0);
      }
      return Status::OK;
    }
    catch (const std::exception &e)
    {
      spdlog::error("GetStock error: {}", e.what());
      return Status(grpc::StatusCode::INTERNAL, e.what());
    }
  }

  Status Adjust(ServerContext *, const inv::AdjustRequest *req, inv::AdjustResponse *res) override
  {
    auto lock_key = "lock:" + req->tenant_id() + ":" + req->sku() + ":" + req->location();
    if (!redis_.set(lock_key, "1", std::chrono::seconds(10), sw::redis::UpdateType::NOT_EXIST))
      return Status(grpc::StatusCode::ABORTED, "busy");

    // RAII cleanup: ensure Redis lock is released even if an exception occurs
    ScopeGuard unlock{[&]
                      { try { redis_.del(lock_key); } catch(...){} }};

    try
    {
      pqxx::connection c(pg_dsn_);
      pqxx::work tx{c};
      pqxx::result r = tx.exec_params(
          "select on_hand, reserved, available from adjust_inventory($1,$2,$3,$4,$5,$6)",
          req->tenant_id(), req->sku(), req->location(), (int)req->qty(),
          req->reason(), req->note());
      tx.commit();

      res->mutable_new_state()->set_on_hand(r[0][0].as<long long>(0));
      res->mutable_new_state()->set_reserved(r[0][1].as<long long>(0));
      res->mutable_new_state()->set_available(r[0][2].as<long long>(0));
      res->set_movement_id("last");

      return Status::OK;
    }
    catch (const std::exception &e)
    {
      spdlog::error("Adjust error: {}", e.what());
      return Status(grpc::StatusCode::INTERNAL, e.what());
    }
  }

private:
  std::string pg_dsn_;
  sw::redis::Redis redis_;
};

int main()
{
  std::string addr = "0.0.0.0:50051";
  std::string pg = env_or("PG_DSN", "postgresql://dev:dev@localhost:5432/omnistock");
  std::string rurl = env_or("REDIS_URL", "tcp://127.0.0.1:6379");

  InventoryImpl service(pg, rurl);
  grpc::ServerBuilder builder;
  builder.AddListeningPort(addr, grpc::InsecureServerCredentials());
  builder.RegisterService(&service);
  std::unique_ptr<Server> server(builder.BuildAndStart());
  spdlog::info("inventory_svc listening on {}", addr);
  server->Wait();
  return 0;
}
