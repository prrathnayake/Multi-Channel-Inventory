const axios = require('axios');

const {
  SHOPIFY_DOMAIN,
  SHOPIFY_ACCESS_TOKEN,
  SHOPIFY_LOCATION_ID,
  OMNISTOCK_BASE_URL = 'http://localhost:8080/v1',
  OMNISTOCK_TENANT = 'demo',
  OMNISTOCK_LOCATION = 'WH1'
} = process.env;

if (!SHOPIFY_DOMAIN || !SHOPIFY_ACCESS_TOKEN || !SHOPIFY_LOCATION_ID) {
  console.error('Missing SHOPIFY_DOMAIN, SHOPIFY_ACCESS_TOKEN, or SHOPIFY_LOCATION_ID environment variables.');
  process.exit(1);
}

const shopifyGraphQL = axios.create({
  baseURL: `https://${SHOPIFY_DOMAIN}/admin/api/2023-10/graphql.json`,
  headers: {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

const omnistockRest = axios.create({
  baseURL: `${OMNISTOCK_BASE_URL.replace(/\/$/, '')}/tenants/${OMNISTOCK_TENANT}`,
  timeout: 10000
});

async function fetchInventorySnapshot() {
  const response = await omnistockRest.get('/stock', {
    params: {
      location: OMNISTOCK_LOCATION
    }
  });
  return response.data.items || [];
}

async function findInventoryItemIdBySku(sku) {
  const query = `#graphql
    query FindVariant($sku: String!) {
      productVariants(first: 1, query: $sku) {
        edges {
          node {
            id
            sku
            inventoryItem {
              id
            }
          }
        }
      }
    }
  `;
  const response = await shopifyGraphQL.post('', { query, variables: { sku } });
  const edges = response.data?.data?.productVariants?.edges || [];
  if (!edges.length) {
    return null;
  }
  return edges[0].node.inventoryItem.id;
}

async function fetchCurrentLevel(inventoryItemId) {
  const query = `#graphql
    query CurrentLevel($inventoryItemId: ID!, $locationId: ID!) {
      inventoryLevel(inventoryItemId: $inventoryItemId, locationId: $locationId) {
        available
      }
    }
  `;
  const response = await shopifyGraphQL.post('', {
    query,
    variables: {
      inventoryItemId,
      locationId: SHOPIFY_LOCATION_ID
    }
  });
  return response.data?.data?.inventoryLevel?.available ?? 0;
}

async function adjustInventory(inventoryItemId, availableDelta) {
  const mutation = `#graphql
    mutation AdjustInventory($inventoryItemId: ID!, $locationId: ID!, $availableDelta: Int!) {
      inventoryAdjustQuantity(input: {
        inventoryItemId: $inventoryItemId,
        locationId: $locationId,
        availableDelta: $availableDelta
      }) {
        inventoryLevel {
          available
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const response = await shopifyGraphQL.post('', {
    query: mutation,
    variables: {
      inventoryItemId,
      locationId: SHOPIFY_LOCATION_ID,
      availableDelta
    }
  });
  const errors = response.data?.data?.inventoryAdjustQuantity?.userErrors;
  if (errors && errors.length) {
    throw new Error(errors.map((err) => `${err.field}: ${err.message}`).join(', '));
  }
  return response.data?.data?.inventoryAdjustQuantity?.inventoryLevel?.available;
}

(async () => {
  try {
    const snapshot = await fetchInventorySnapshot();
    for (const item of snapshot) {
      const sku = item.sku;
      const target = Number(item.available ?? 0);
      if (!sku) {
        continue;
      }
      const inventoryItemId = await findInventoryItemIdBySku(sku);
      if (!inventoryItemId) {
        console.log(`SKU ${sku} not found in Shopify; skipping.`);
        continue;
      }
      const current = await fetchCurrentLevel(inventoryItemId);
      const delta = target - current;
      if (delta === 0) {
        console.log(`SKU ${sku} already at ${current}, no change.`);
        continue;
      }
      const updated = await adjustInventory(inventoryItemId, delta);
      console.log(`Adjusted SKU ${sku} by ${delta}. Available now ${updated}.`);
    }
    console.log('Sync complete.');
  } catch (err) {
    console.error('Sync failed:', err.response?.data || err.message || err);
    process.exit(1);
  }
})();
