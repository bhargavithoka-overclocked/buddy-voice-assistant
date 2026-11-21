const fs = require("fs");
const os = require("os");
const path = require("path");

// The only thing Buddy keeps outside the user's chosen folder: a tiny file that
// remembers where that folder is. Uninstalling removes it too.
const POINTER_FILE = path.join(os.homedir(), "Library", "Preferences", "com.bhargavithoka.buddy.json");

// dropped in the data folder so we can always tell it's ours (and safe to delete on uninstall)
const MARKER = ".buddy-data";

const DEFAULT_PARENT = path.join(os.homedir(), "Library", "Application Support");

function readDataDir() {
  // handy while developing: BUDDY_DATA_DIR=/some/folder npm start
  if (process.env.BUDDY_DATA_DIR) return process.env.BUDDY_DATA_DIR;
  try {
    const { dataDir } = JSON.parse(fs.readFileSync(POINTER_FILE, "utf8"));
    return dataDir && fs.existsSync(path.join(dataDir, MARKER)) ? dataDir : null;
  } catch {
    return null;
  }
}

function saveDataDir(dataDir) {
  fs.mkdirSync(path.dirname(POINTER_FILE), { recursive: true });
  fs.writeFileSync(POINTER_FILE, JSON.stringify({ dataDir }, null, 2));
}

function forgetDataDir() {
  fs.rmSync(POINTER_FILE, { force: true });
}

// Everything goes in a "Buddy" folder inside whatever the user picks, so picking
// e.g. Documents never mixes Buddy's files with theirs.
function buddyFolderIn(parent) {
  return path.basename(parent) === "Buddy" ? parent : path.join(parent, "Buddy");
}

function isBuddyFolder(dir) {
  return fs.existsSync(path.join(dir, MARKER));
}

function layout(dataDir) {
  return {
    root: dataDir,
    electron: path.join(dataDir, "app"), // Electron's own cache and storage
    logs: path.join(dataDir, "logs"),
    ollama: path.join(dataDir, "ollama"),
    ollamaModels: path.join(dataDir, "ollama", "models"),
    ollamaHome: path.join(dataDir, "ollama", "home"),
    voices: path.join(dataDir, "voices"),
    whisper: path.join(dataDir, "whisper"),
    setupDone: path.join(dataDir, "setup.json"),
  };
}

module.exports = {
  POINTER_FILE, MARKER, DEFAULT_PARENT,
  readDataDir, saveDataDir, forgetDataDir, buddyFolderIn, isBuddyFolder, layout,
};
