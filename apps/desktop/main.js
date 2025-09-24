const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    apiBaseUrl: 'http://localhost:8080/v1',
    tenantId: 'demo',
    location: 'WH1'
  }
});

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'public', 'index.html'));
};

ipcMain.handle('settings:get', () => {
  return {
    apiBaseUrl: store.get('apiBaseUrl'),
    tenantId: store.get('tenantId'),
    location: store.get('location')
  };
});

ipcMain.handle('settings:set', (_event, next) => {
  store.set(next);
  return store.store;
});

ipcMain.handle('inventory:list', async (_event, sku) => {
  const settings = store.store;
  const url = new URL(`${settings.apiBaseUrl}/tenants/${settings.tenantId}/stock`);
  if (sku) {
    url.searchParams.set('sku', sku);
  }
  if (settings.location) {
    url.searchParams.set('location', settings.location);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch inventory: ${response.status}`);
  }
  return response.json();
});

ipcMain.handle('orders:create', async (_event, payload) => {
  const settings = store.store;
  const url = `${settings.apiBaseUrl}/tenants/${settings.tenantId}/orders`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Order creation failed: ${response.status} ${text}`);
  }
  return response.json();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
