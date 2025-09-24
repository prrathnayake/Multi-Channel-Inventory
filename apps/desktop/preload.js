const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('omnistock', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:set', payload),
  fetchInventory: (sku) => ipcRenderer.invoke('inventory:list', sku),
  createOrder: (payload) => ipcRenderer.invoke('orders:create', payload)
});
