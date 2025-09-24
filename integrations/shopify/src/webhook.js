const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

const {
  SHOPIFY_WEBHOOK_SECRET,
  OMNISTOCK_BASE_URL = 'http://localhost:8080/v1',
  OMNISTOCK_TENANT = 'demo'
} = process.env;

if (!SHOPIFY_WEBHOOK_SECRET) {
  console.error('SHOPIFY_WEBHOOK_SECRET must be set to validate webhooks.');
  process.exit(1);
}

const app = express();
app.use(bodyParser.json({ verify: (req, res, buf) => {
  req.rawBody = buf;
}}));

const verifySignature = (req) => {
  const hmac = crypto.createHmac('sha256', SHOPIFY_WEBHOOK_SECRET);
  hmac.update(req.rawBody);
  const digest = hmac.digest('base64');
  const received = req.get('X-Shopify-Hmac-Sha256');
  return digest === received;
};

app.post('/webhooks/orders/create', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  const order = req.body;
  const lines = (order.line_items || []).map((item) => ({
    sku: item.sku,
    quantity: item.quantity
  })).filter((line) => line.sku && line.quantity);

  try {
    const response = await axios.post(`${OMNISTOCK_BASE_URL.replace(/\/$/, '')}/tenants/${OMNISTOCK_TENANT}/orders`, {
      clientReference: `shopify-${order.id}`,
      lines
    });
    res.status(202).json({ status: 'queued', omnistockOrder: response.data });
  } catch (err) {
    console.error('Failed to forward order:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Failed to forward order to OmniStock' });
  }
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Shopify webhook listener running on ${port}`);
});
