const { app, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const downloads = require("./downloads");
const { DEFAULT_PARENT, MARKER, buddyFolderIn, layout, saveDataDir } = require("./paths");
const services = require("./services");

/** The setup wizard's side of things: folder picking, the download plan and running it. */
function registerSetupHandlers(window) {
  ipcMain.handle("setup:defaults", () => ({
    folder: buddyFolderIn(DEFAULT_PARENT),
  }));

  ipcMain.handle("setup:choose-folder", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "Where should Buddy keep his things?",
      buttonLabel: "Use this folder",
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : buddyFolderIn(result.filePaths[0]);
  });

  ipcMain.handle("setup:plan", async (_event, folder) => ({
    items: downloads.plan(folder),
    freeSpace: await downloads.freeSpace(folder),
    existing: fs.existsSync(path.join(folder, MARKER)),
  }));

  ipcMain.handle("setup:run", async (_event, folder, chosenIds) => {
    const dirs = layout(folder);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, MARKER), "This folder belongs to Buddy. Deleting it removes all of Buddy's data.\n");

    const progress = (id, update) => window.webContents.send("setup:progress", { id, ...update });
    const items = downloads.plan(folder).filter((i) => chosenIds.includes(i.id) && !i.installed);

    try {
      // plain files first, then start the engine so it can fetch the models
      for (const item of items.filter((i) => !i.model)) {
        progress(item.id, { status: "Downloading..." });
        await downloads.downloadFiles(item, dirs, (update) => progress(item.id, update));
        progress(item.id, { status: "Done", finished: true });
      }
      const models = items.filter((i) => i.model);
      if (models.length) {
        await services.startOllama(folder);
        for (const item of models) {
          progress(item.id, { status: "Downloading..." });
          await downloads.pullModel(services.OLLAMA_URL, item.model, (update) => progress(item.id, update));
          progress(item.id, { status: "Done", finished: true });
        }
      }
      fs.writeFileSync(dirs.setupDone, JSON.stringify({ setUpAt: new Date().toISOString() }, null, 2));
      saveDataDir(folder);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err.message };
    } finally {
      services.stopAll();
    }
  });

  // start again with the new folder (Electron's own storage moves there on launch)
  ipcMain.handle("setup:finish", () => {
    app.relaunch();
    app.exit(0);
  });
}

module.exports = { registerSetupHandlers };
