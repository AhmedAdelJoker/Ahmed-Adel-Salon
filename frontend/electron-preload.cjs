const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  getExternalPath: () => ipcRenderer.invoke('get-external-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  openExternalData: () => ipcRenderer.invoke('open-external-data'),
  onBackendReady: (callback) => {
    ipcRenderer.on('backend-ready', callback);
    return () => ipcRenderer.off('backend-ready', callback);
  },
  openExternal: (url) => ipcRenderer.send('open-external', url)
});