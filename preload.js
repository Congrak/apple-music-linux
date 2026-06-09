const { contextBridge, ipcRenderer } = require('electron');

// Expose window control function to the page
contextBridge.exposeInMainWorld('__wc', (action) => {
  ipcRenderer.send('wc', action);
});
