const { contextBridge, ipcRenderer } = require("electron");

// The small set of things the pages are allowed to ask the app to do.
contextBridge.exposeInMainWorld("buddyDesktop", {
  info: () => ipcRenderer.invoke("app:info"),
  showDataFolder: () => ipcRenderer.invoke("app:show-data-folder"),
});
