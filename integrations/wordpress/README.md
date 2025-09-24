# WooCommerce Plugin

The `omnistock-live-stock` plugin displays real-time availability from OmniStock on WooCommerce product pages.

## Installation

1. Zip the plugin folder:
   ```bash
   cd integrations/wordpress
   zip -r omnistock-live-stock.zip omnistock-live-stock
   ```
2. Upload the zip inside `WordPress Admin → Plugins → Add New → Upload Plugin`.
3. Activate **OmniStock Live Stock**.

## Configuration

Navigate to **Settings → OmniStock** and provide:

- **API URL** – default `http://localhost:8080`
- **Tenant** – default `demo`

When a product with a SKU is viewed, the plugin requests `GET /v1/tenants/{tenant}/stock?sku=<SKU>&location=WH1` from OmniStock and renders the available quantity.
