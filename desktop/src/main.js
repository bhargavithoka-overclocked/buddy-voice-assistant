const { app, BrowserWindow, dialog, ipcMain, session, shell, systemPreferences } = require("electron");
const path = require("path");
const { layout, readDataDir } = require("./paths");
const services = require("./services");

const dataDir = readDataDir();

// keep Electron's own files (cache, local storage) inside the Buddy folder too
if (dataDir) app.setPath("userData", layout(dataDir).electron);

// Buddy talks as soon as he's woken by voice, without waiting for a click
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

let mainWindow = null;

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "Buddy",
    backgroundColor: "#15131a",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  mainWindow.loadURL(url);
  // links (like "get a Gemini key") open in the normal browser
  mainWindow.webContents.setWindowOpenHandler(({ url: link }) => {
    shell.openExternal(link);
    return { action: "deny" };
  });
}

function allowMicrophone() {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === "media");
  });
  if (process.platform === "darwin") systemPreferences.askForMediaAccess("microphone");
}

async function launch() {
  if (!dataDir) {
    await dialog.showMessageBox({
      type: "info",
      message: "Buddy isn't set up yet.",
      detail: "While developing, start it with BUDDY_DATA_DIR set to a Buddy folder.",
    });
    app.quit();
    return;
  }
  try {
    createWindow(await services.startAll(dataDir));
  } catch (err) {
    dialog.showErrorBox("Buddy couldn't start", `${err.message}\n\nLogs are in ${layout(dataDir).logs}`);
    app.quit();
  }
}

ipcMain.handle("app:info", () => ({ dataDir, version: app.getVersion() }));
ipcMain.handle("app:show-data-folder", () => dataDir && shell.openPath(dataDir));

app.whenReady().then(() => {
  allowMicrophone();
  launch();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => services.stopAll());
