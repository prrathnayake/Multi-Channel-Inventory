# Shopify Integration

Two scripts help synchronise OmniStock inventory with Shopify and forward Shopify orders into OmniStock:

- `npm run sync` compares OmniStock availability against your Shopify location and adjusts inventory levels.
- `npm run webhook` starts an Express listener to receive Shopify order webhooks and create matching OmniStock orders.

## Prerequisites

Set the following environment variables before running either script:

| Variable | Description |
| --- | --- |
| `SHOPIFY_DOMAIN` | Your store domain, e.g. `example.myshopify.com`. |
| `SHOPIFY_ACCESS_TOKEN` | Admin API access token with read/write inventory permissions. |
| `SHOPIFY_LOCATION_ID` | GraphQL ID of the Shopify location to adjust, e.g. `gid://shopify/Location/1234567890`. |
| `SHOPIFY_WEBHOOK_SECRET` | (webhook only) Shared secret used to verify webhook signatures. |
| `OMNISTOCK_BASE_URL` | Base URL to Envoy, default `http://localhost:8080/v1`. |
| `OMNISTOCK_TENANT` | OmniStock tenant identifier, default `demo`. |
| `OMNISTOCK_LOCATION` | OmniStock location filter when fetching stock, default `WH1`. |

Install dependencies once:

```bash
cd integrations/shopify
npm install
```

### Inventory sync

```bash
npm run sync
```

The script fetches inventory from OmniStock, looks up Shopify variants by SKU, compares the current quantity at `SHOPIFY_LOCATION_ID`, and issues `inventoryAdjustQuantity` mutations.

### Order webhook bridge

```bash
SHOPIFY_WEBHOOK_SECRET=... npm run webhook
```

Point your Shopify order creation webhook to `https://<host>/webhooks/orders/create`. The bridge validates the signature, extracts line items, and posts a corresponding OmniStock order.
