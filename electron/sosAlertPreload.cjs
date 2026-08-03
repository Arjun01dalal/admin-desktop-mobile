const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sosAlert', {
  acknowledge: () => ipcRenderer.send('sos:acknowledge'),
});
