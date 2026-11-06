const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("jobtrackUpdates", Object.freeze({
  getState: () => ipcRenderer.invoke("jobtrack:update:state"),
  check: () => ipcRenderer.invoke("jobtrack:update:check"),
  download: () => ipcRenderer.invoke("jobtrack:update:download"),
  cancel: () => ipcRenderer.invoke("jobtrack:update:cancel"),
  install: () => ipcRenderer.invoke("jobtrack:update:install"),
  subscribe: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("jobtrack:update:state", listener);
    return () => ipcRenderer.removeListener("jobtrack:update:state", listener);
  },
}));
