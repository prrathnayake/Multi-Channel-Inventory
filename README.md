# OmniStock — C++ gRPC Inventory Template

Multi-tenant, high-performance inventory/warehouse template with:
- C++20 microservices (gRPC)
- Envoy REST↔gRPC transcoding
- PostgreSQL + Redis + Kafka
- Next.js web (App Router)
- Docker Compose for dev

## Quick Start
```bash
# 1) Generate protobuf descriptors
protoc -I=proto --include_imports --include_source_info   --descriptor_set_out=proto/descriptors.pb proto/*.proto

# 2) Start dev stack
docker compose -f deploy/docker-compose.yml up --build

# 3) Open the web app
open http://localhost:3000
```
