# OmniStock — C++ gRPC Inventory Template

Multi-tenant, high-performance inventory/warehouse template with:
- C++20 microservices (gRPC)
- Envoy REST↔gRPC transcoding
- PostgreSQL + Redis + Kafka
- Next.js web (App Router)
- Docker Compose for dev

## Development Setup
<<<<<<< codex/review-the-project-ynuseo

1. **Fetch Google API annotations** (required for REST↔gRPC transcoding):
   ```bash
   git submodule update --init --recursive third_party/googleapis
   # or manually download google/api/{annotations,http}.proto into third_party/googleapis
   ```

2. **Generate descriptor set for Envoy’s transcoder**:
   ```bash
   protoc -I=proto -I=third_party/googleapis \
     --include_imports --include_source_info \
     --descriptor_set_out=proto/descriptors.pb proto/*.proto
   ```

3. **Start the full stack** (PostgreSQL, Redis, Kafka, gRPC services, Envoy, and the Next.js UI):
   ```bash
   docker compose -f deploy/docker-compose.yml up --build
   ```

4. **Visit the UI** at [http://localhost:3000](http://localhost:3000) to adjust stock levels and create orders. The UI talks to Envoy’s REST endpoint which transparently proxies gRPC calls.

## Client Applications

| Surface | Path | Purpose |
| --- | --- | --- |
| Web | `web/` | Next.js App Router UI shipped with Docker Compose (port 3000). |
| Desktop | `apps/desktop/` | Electron shell for quick inventory lookups and order entry. |
| Mobile | `apps/mobile/` | Expo (React Native) app optimised for tablets/phones. |

Each client shares the same REST endpoints. Update the base URL/tenant inputs if your stack is not running locally.

### Desktop

```bash
cd apps/desktop
npm install
npm start
```

### Mobile (Expo)

```bash
cd apps/mobile
npm install
npm run start
```

Scan the QR code with Expo Go or launch an emulator. Adjust API details from within the app header.
=======

1. **Fetch Google API annotations** (required for REST↔gRPC transcoding):
   ```bash
   git submodule update --init --recursive third_party/googleapis
   # or manually download google/api/{annotations,http}.proto into third_party/googleapis
   ```

2. **Generate descriptor set for Envoy’s transcoder**:
   ```bash
   protoc -I=proto -I=third_party/googleapis \
     --include_imports --include_source_info \
     --descriptor_set_out=proto/descriptors.pb proto/*.proto
   ```

3. **Start the full stack** (PostgreSQL, Redis, Kafka, gRPC services, Envoy, and the Next.js UI):
   ```bash
   docker compose -f deploy/docker-compose.yml up --build
   ```

4. **Visit the UI** at [http://localhost:3000](http://localhost:3000) to adjust stock levels and create orders. The UI talks to Envoy’s REST endpoint which transparently proxies gRPC calls.
>>>>>>> main

### Service Highlights

- **Inventory Service** — uses PostgreSQL for the authoritative stock ledger and Redis-backed leases that renew automatically, preventing concurrent writers from trampling long running adjustments.
- **Orders Service** — persists orders and line items to PostgreSQL, enqueues outbox rows, and publishes an `orders.created` Kafka event for downstream connectors. Idempotent requests are guarded with Redis locks keyed by tenant/external id.
- **Envoy Gateway** — exposes `/v1/tenants/{tenantId}/stock`, `/movements/adjust`, and `/orders` with distinct routing rules so both services are reachable via REST.

<<<<<<< codex/review-the-project-ynuseo
### Commerce Integrations

- **WooCommerce** — `integrations/wordpress/` contains a plugin that embeds live OmniStock availability on product pages.
- **Shopify** — `integrations/shopify/` provides scripts for inventory synchronisation and an order webhook bridge. See the directory README for environment variables and usage.

=======
>>>>>>> main
### Resetting the Database

The seed script under `deploy/seed/00_schema.sql` bootstraps tenants, products, inventory, and the new `orders`/`order_lines` tables. To start fresh, remove the `pgdata` volume (`docker volume rm deploy_pgdata`) and re-run Docker Compose.
