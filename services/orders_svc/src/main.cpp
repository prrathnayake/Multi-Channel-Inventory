#include <grpcpp/grpcpp.h>
#include "orders.grpc.pb.h"
#include <spdlog/spdlog.h>

using grpc::Server; using grpc::ServerBuilder; using grpc::ServerContext; using grpc::Status;
namespace ord = omnistock::orders::v1;

class OrdersImpl final : public ord::OrdersService::Service {
  Status Create(ServerContext*, const ord::CreateOrderReq* req, ord::CreateOrderRes* res) override {
    // Minimal stub: echo an order id and initial state
    res->set_order_id(req->id().empty() ? "generated-id" : req->id());
    res->set_state("NEW");
    spdlog::info("Order created tenant={} id={}", req->tenant_id(), res->order_id());
    return Status::OK;
  }
};

int main() {
  std::string addr="0.0.0.0:50052";
  OrdersImpl svc;
  ServerBuilder b; b.AddListeningPort(addr, grpc::InsecureServerCredentials()); b.RegisterService(&svc);
  auto server = b.BuildAndStart();
  spdlog::info("orders_svc listening on {}", addr);
  server->Wait();
  return 0;
}
