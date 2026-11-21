const { app, BrowserWindow, dialog, ipcMain, session, shell, systemPreferences } = require("electron");
const path = require("path");
const fs = require("fs");
const { layout, readDataDir } = require("./paths");
const services = require("./services");
const { registerSetupHandlers } = require("./setup");

const dataDir = readDataDir();
const needsSetup = !dataDir || !fs.existsSync(layout(dataDir).setupDone);

// keep Electron's own files (cache, local storage) inside the Buddy folder too.
// Before setup there's no folder yet, so use a throwaway one.
app.setPath("userData", needsSetup ? path.join(app.getPath("temp"), "buddy-setup") : layout(dataDir).electron);

// the throwaway folder from setup isn't needed once Buddy has a real one
if (!needsSetup) fs.rmSync(path.join(app.getPath("temp"), "buddy-setup"), { recursive: true, force: true });

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

function openSetup() {
  const window = new BrowserWindow({
    width: 720,
    height: 620,
    resizable: false,
    title: "Set up Buddy",
    backgroundColor: "#15131a",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  registerSetupHandlers(window);
  window.loadFile(path.join(__dirname, "setup", "index.html"));
}

async function launch() {
  if (needsSetup) {
    openSetup();
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
