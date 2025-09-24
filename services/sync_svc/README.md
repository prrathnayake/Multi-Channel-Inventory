# sync_svc (placeholder)
Connector workers for Shopify/WooCommerce. Suggested approach:
- HTTP client: cpr or Boost.Beast
- OAuth/HMAC helpers
- Kafka in/out:
  - in: channel.orders.created -> OrdersService.Create
  - out: subscribe 'stock.updated' -> push to channels
