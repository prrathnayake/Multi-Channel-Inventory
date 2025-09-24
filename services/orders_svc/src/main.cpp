#include <grpcpp/grpcpp.h>
#include "orders.grpc.pb.h"

#include <pqxx/pqxx>
#include <sw/redis++/redis++.h>
#include <rdkafkacpp.h>
#include <spdlog/spdlog.h>

#include <chrono>
#include <cstdlib>
#include <iomanip>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>

#include "../../common/redis_lock.h"

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;
namespace ord = omnistock::orders::v1;

namespace
{
std::string env_or(const char *key, const char *defv)
{
  const char *v = std::getenv(key);
  return v ? std::string(v) : std::string(defv);
}

std::string json_escape(const std::string &value)
{
  std::string out;
  out.reserve(value.size() + 8);
  for (char c : value)
  {
    switch (c)
    {
    case '"':
      out += "\\\"";
      break;
    case '\\':
      out += "\\\\";
      break;
    case '\b':
      out += "\\b";
      break;
    case '\f':
      out += "\\f";
      break;
    case '\n':
      out += "\\n";
      break;
    case '\r':
      out += "\\r";
      break;
    case '\t':
      out += "\\t";
      break;
    default:
      if (static_cast<unsigned char>(c) < 0x20)
      {
        std::ostringstream oss;
        oss << "\\u" << std::hex << std::uppercase << std::setw(4) << std::setfill('0')
            << static_cast<int>(static_cast<unsigned char>(c));
        out += oss.str();
      }
      else
      {
        out.push_back(c);
      }
    }
  }
  return out;
}

std::string build_order_payload(const std::string &order_id, const ord::CreateOrderReq &req)
{
  std::ostringstream oss;
  oss << "{\"order_id\":\"" << json_escape(order_id) << "\",";
  oss << "\"tenant_id\":\"" << json_escape(req.tenant_id()) << "\",";
  if (!req.id().empty())
  {
    oss << "\"external_id\":\"" << json_escape(req.id()) << "\",";
  }
  oss << "\"lines\":[";
  for (int i = 0; i < req.lines_size(); ++i)
  {
    if (i > 0)
      oss << ',';
    const auto &line = req.lines(i);
    oss << "{\"sku\":\"" << json_escape(line.sku()) << "\",\"qty\":" << line.qty() << "}";
  }
  oss << "]}";
  return oss.str();
}

class KafkaProducer
{
public:
  KafkaProducer(const std::string &brokers, std::string topic)
      : topic_(std::move(topic))
  {
    RdKafka::Conf *conf = RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL);
    if (!conf)
    {
      throw std::runtime_error("failed to create kafka conf");
    }
    std::string errstr;
    if (conf->set("bootstrap.servers", brokers, errstr) != RdKafka::Conf::CONF_OK)
    {
      delete conf;
      throw std::runtime_error("kafka config error: " + errstr);
    }
    producer_.reset(RdKafka::Producer::create(conf, errstr));
    delete conf;
    if (!producer_)
    {
      throw std::runtime_error("failed to create kafka producer: " + errstr);
    }
  }

  void publish(const std::string &payload)
  {
    RdKafka::ErrorCode err = producer_->produce(topic_, RdKafka::Topic::PARTITION_UA,
                                                RdKafka::Producer::RK_MSG_COPY,
                                                const_cast<char *>(payload.data()),
                                                payload.size(), nullptr, 0, 0, nullptr, nullptr);
    if (err != RdKafka::ERR_NO_ERROR)
    {
      throw std::runtime_error("kafka publish failed: " + RdKafka::err2str(err));
    }
    producer_->poll(0);
  }

  ~KafkaProducer()
  {
    if (producer_)
    {
      producer_->flush(5000);
    }
  }

private:
  std::string topic_;
  std::unique_ptr<RdKafka::Producer> producer_;
};

} // namespace

class OrdersImpl final : public ord::OrdersService::Service
{
public:
  OrdersImpl(std::string pg_dsn, std::string redis_url, std::string kafka_brokers)
      : pg_dsn_(std::move(pg_dsn)), redis_(redis_url), kafka_(kafka_brokers, "orders.created") {}

  Status Create(ServerContext *, const ord::CreateOrderReq *req, ord::CreateOrderRes *res) override
  {
    if (req->tenant_id().empty())
    {
      return Status(grpc::StatusCode::INVALID_ARGUMENT, "tenant_id is required");
    }
    if (req->lines_size() == 0)
    {
      return Status(grpc::StatusCode::INVALID_ARGUMENT, "order must contain at least one line");
    }
    for (const auto &line : req->lines())
    {
      if (line.sku().empty() || line.qty() <= 0)
      {
        return Status(grpc::StatusCode::INVALID_ARGUMENT, "each line requires sku and qty > 0");
      }
    }

    std::unique_ptr<RedisLease> id_lock;
    if (!req->id().empty())
    {
      auto key = "lock:order:" + req->tenant_id() + ":" + req->id();
      auto guard = std::make_unique<RedisLease>(redis_, key, std::chrono::seconds(30));
      if (!guard->acquired())
      {
        return Status(grpc::StatusCode::ALREADY_EXISTS, "order creation already in progress");
      }
      id_lock = std::move(guard);
    }

    std::string order_id;
    std::string state = "NEW";
    std::string payload;

    try
    {
      pqxx::connection conn(pg_dsn_);
      pqxx::work tx{conn};

      pqxx::result tenant = tx.exec_params("select 1 from tenants where id=$1", req->tenant_id());
      if (tenant.empty())
      {
        return Status(grpc::StatusCode::NOT_FOUND, "tenant not found");
      }

      if (!req->id().empty())
      {
        pqxx::result existing = tx.exec_params(
            "select id, state from orders where tenant_id=$1 and external_id=$2",
            req->tenant_id(), req->id());
        if (!existing.empty())
        {
          res->set_order_id(existing[0][0].c_str());
          res->set_state(existing[0][1].c_str());
          return Status::OK;
        }
      }

      pqxx::row inserted = tx.exec_params1(
          "insert into orders(tenant_id, external_id, state) values ($1, nullif($2,''), 'NEW')"
          " returning id, state",
          req->tenant_id(), req->id());
      order_id = inserted[0].as<std::string>();
      state = inserted[1].as<std::string>("NEW");

      for (const auto &line : req->lines())
      {
        tx.exec_params("insert into order_lines(order_id, sku, qty) values ($1,$2,$3)",
                       order_id, line.sku(), static_cast<long long>(line.qty()));
      }

      payload = build_order_payload(order_id, *req);
      tx.exec_params("insert into outbox(topic, payload) values ($1, $2::jsonb)",
                     "orders.created", payload);

      tx.commit();
    }
    catch (const std::exception &e)
    {
      spdlog::error("Create order failed: {}", e.what());
      return Status(grpc::StatusCode::INTERNAL, e.what());
    }

    try
    {
      kafka_.publish(payload);
    }
    catch (const std::exception &e)
    {
      spdlog::warn("orders.created publish failed (will rely on outbox): {}", e.what());
    }

    res->set_order_id(order_id);
    res->set_state(state);
    spdlog::info("Order created tenant={} id={}", req->tenant_id(), order_id);
    return Status::OK;
  }

private:
  std::string pg_dsn_;
  sw::redis::Redis redis_;
  KafkaProducer kafka_;
};

int main()
{
  std::string addr = "0.0.0.0:50052";
  std::string pg = env_or("PG_DSN", "postgresql://dev:dev@localhost:5432/omnistock");
  std::string redis = env_or("REDIS_URL", "tcp://127.0.0.1:6379");
  std::string brokers = env_or("KAFKA_BROKER", "localhost:9092");

  try
  {
    OrdersImpl service(pg, redis, brokers);
    ServerBuilder builder;
    builder.AddListeningPort(addr, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);
    std::unique_ptr<Server> server(builder.BuildAndStart());
    spdlog::info("orders_svc listening on {}", addr);
    server->Wait();
  }
  catch (const std::exception &e)
  {
    spdlog::critical("orders_svc failed to start: {}", e.what());
    return 1;
  }
  return 0;
}
