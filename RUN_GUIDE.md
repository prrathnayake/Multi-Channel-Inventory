# OmniStock Application Run Guide

This companion guide explains how to run each OmniStock component independently so you can iterate on one surface at a time. Every section lists the prerequisites, configuration knobs, and commands required to boot that portion of the system without launching the entire Docker Compose stack.

## Shared prerequisites

Before working with individual applications, make sure the following tools are installed locally:

- **Docker & Docker Compose v2** – used for standing up the backing services (PostgreSQL, Redis, Kafka) and any containerised components.
- **Node.js 18+ and npm** – required by the web, desktop, mobile, and JavaScript-based integration utilities.
- **CMake 3.22+ and a C++20 toolchain** – only necessary if you intend to run the C++ services outside of Docker.

You also need the compiled protobuf descriptor so Envoy can translate between REST and gRPC:

```bash
git submodule update --init --recursive third_party/googleapis
protoc -I=proto -I=third_party/googleapis \
  --include_imports --include_source_info \
  --descriptor_set_out=proto/descriptors.pb proto/*.proto
```

## Running shared infrastructure only

Many components depend on PostgreSQL, Redis, and Kafka. You can start just these containers in the background:

```bash
docker compose -f deploy/docker-compose.yml up postgres redis kafka -d
```

> The seed SQL in `deploy/seed/` automatically initialises the `omnistock` database when PostgreSQL starts for the first time.

Stop the infrastructure when you are done:

```bash
docker compose -f deploy/docker-compose.yml down
```

## Inventory service (C++)

### Run inside Docker

```bash
docker compose -f deploy/docker-compose.yml up inventory_svc
```

This command mounts the service source, builds it inside a container, and connects to the Compose-managed PostgreSQL and Redis instances.

### Run locally with CMake

1. Install the runtime dependencies (`libpqxx`, `redis++`, `librdkafka`, `spdlog`, `gRPC`, `protobuf`). Package managers such as `brew`, `apt`, or `vcpkg` can provide these libraries.
2. Configure and build:
   ```bash
   cmake -S services/inventory_svc -B build/inventory_svc
   cmake --build build/inventory_svc
   ```
3. Export connection settings (mirroring the Compose defaults) and start the binary:
   ```bash
   export PG_DSN="postgresql://dev:dev@localhost:5432/omnistock"
   export REDIS_URL="tcp://localhost:6379"
   ./build/inventory_svc/inventory_svc
   ```

## Orders service (C++)

### Run inside Docker

```bash
docker compose -f deploy/docker-compose.yml up orders_svc
```

### Run locally with CMake

Follow the same build steps as the inventory service, then provide the Kafka broker endpoint in addition to the database and cache URLs:

```bash
export PG_DSN="postgresql://dev:dev@localhost:5432/omnistock"
export REDIS_URL="tcp://localhost:6379"
export KAFKA_BROKER="localhost:9092"
./build/orders_svc/orders_svc
```

## Envoy API gateway

Envoy exposes the REST interface that the clients consume. Ensure `proto/descriptors.pb` exists before starting Envoy.

### Run inside Docker

```bash
docker compose -f deploy/docker-compose.yml up envoy
```

### Run locally

1. Install Envoy (macOS: `brew install envoy`, Ubuntu: `apt install envoy` via the official repo).
2. Export the path to the descriptor file and launch using the provided configuration:
   ```bash
   envoy -c api-gateway/envoy.yaml \
     --service-cluster omnistock-dev \
     --log-level info
   ```
   The configuration references `proto/descriptors.pb`; keep the file path identical to the repository layout or update the `api-gateway/envoy.yaml` mount accordingly.

Envoy listens on port **8080** for REST traffic and **9901** for the admin interface.

## Next.js web application (`web/`)

### Development mode

```bash
cd web
npm install
NEXT_PUBLIC_API_URL="http://localhost:8080" npm run dev
```

- The dev server runs on [http://localhost:3000](http://localhost:3000).
- Change `NEXT_PUBLIC_API_URL` if Envoy is running on a different host/port.

### Production build preview

```bash
cd web
npm install
npm run build
NEXT_PUBLIC_API_URL="http://localhost:8080" npm run start
```

## Electron desktop console (`apps/desktop/`)

```bash
cd apps/desktop
npm install
npm start
```

- The first launch prompts for the API base URL and tenant; the settings are persisted via `electron-store` in the user’s config directory.
- Ensure Envoy is reachable from your workstation (default: `http://localhost:8080`).

## Expo mobile client (`apps/mobile/`)

1. Install the Expo CLI if you do not already have it: `npm install -g expo-cli` (or use `npx expo`).
2. Start the Metro bundler:
   ```bash
   cd apps/mobile
   npm install
   npm run start
   ```
3. Scan the QR code with the Expo Go app or run an emulator using `npm run android` or `npm run ios`.
4. Adjust the connection settings at the top of the home screen if Envoy is not on `http://localhost:8080/v1`. You can also edit the defaults in `app.json` under `expo.extra`.

## Shopify integration scripts (`integrations/shopify/`)

Install dependencies once:

```bash
cd integrations/shopify
npm install
```

### Inventory synchronisation

```bash
SHOPIFY_DOMAIN=<your-store.myshopify.com> \
SHOPIFY_ACCESS_TOKEN=<admin-api-token> \
SHOPIFY_LOCATION_ID=<gid://shopify/Location/...> \
OMNISTOCK_BASE_URL="http://localhost:8080/v1" \
OMNISTOCK_TENANT=demo \
OMNISTOCK_LOCATION=WH1 \
npm run sync
```

The script walks OmniStock inventory and adjusts Shopify stock levels to match.

### Order ingestion webhook

```bash
SHOPIFY_WEBHOOK_SECRET=<shared-secret> \
OMNISTOCK_BASE_URL="http://localhost:8080/v1" \
OMNISTOCK_TENANT=demo \
PORT=3002 \
npm run webhook
```

Expose the webhook publicly (e.g., with ngrok) and register the URL in Shopify’s admin so new orders are forwarded to OmniStock.

## WooCommerce plugin (`integrations/wordpress/`)

1. Package the plugin:
   ```bash
   cd integrations/wordpress
   zip -r omnistock-live-stock.zip omnistock-live-stock
   ```
2. Upload the archive via **WordPress Admin → Plugins → Add New → Upload Plugin**.
3. Configure the OmniStock endpoint under **Settings → OmniStock** with your Envoy URL and tenant.

## Running the Next.js app via Docker only

If you prefer to use Docker for the frontend while other services run locally:

```bash
docker compose -f deploy/docker-compose.yml up web
```

Set `NEXT_PUBLIC_API_URL` in `deploy/docker-compose.yml` or via the command line to point at the correct Envoy host.

---

Use these component-specific instructions alongside the main `README.md` to mix-and-match the services you need for a given development task.
