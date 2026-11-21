const { contextBridge, ipcRenderer } = require("electron");

// The small set of things the pages are allowed to ask the app to do.
contextBridge.exposeInMainWorld("buddyDesktop", {
  info: () => ipcRenderer.invoke("app:info"),
  showDataFolder: () => ipcRenderer.invoke("app:show-data-folder"),

  // first-run setup
  setup: {
    defaults: () => ipcRenderer.invoke("setup:defaults"),
    chooseFolder: () => ipcRenderer.invoke("setup:choose-folder"),
    plan: (folder) => ipcRenderer.invoke("setup:plan", folder),
    run: (folder, ids) => ipcRenderer.invoke("setup:run", folder, ids),
    onProgress: (callback) => ipcRenderer.on("setup:progress", (_event, update) => callback(update)),
    finish: () => ipcRenderer.invoke("setup:finish"),
  },
});
