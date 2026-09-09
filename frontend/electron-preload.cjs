const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  onBackendReady: (callback) => {
    ipcRenderer.on('backend-ready', callback);
    return () => ipcRenderer.off('backend-ready', callback);
  },
  openExternal: (url) => ipcRenderer.send('open-external', url)
});