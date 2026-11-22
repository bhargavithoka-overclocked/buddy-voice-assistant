const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const { app } = require("electron");
const { layout } = require("./paths");

// Buddy runs his own copy of Ollama on its own port, so it never touches
// (or depends on) an Ollama the user may have installed themselves.
const OLLAMA_PORT = 11435;
const OLLAMA_URL = `http://127.0.0.1:${OLLAMA_PORT}`;

const running = [];

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitFor(url, seconds = 60) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function start(name, command, args, options) {
  const dirs = layout(options.dataDir);
  fs.mkdirSync(dirs.logs, { recursive: true });
  const log = fs.openSync(path.join(dirs.logs, `${name}.log`), "a");
  const child = spawn(command, args, { ...options, stdio: ["ignore", log, log] });
  child.on("exit", (code) => console.log(`${name} exited (${code})`));
  running.push(child);
  return child;
}

function findOllama(dataDir) {
  // the download unpacks to ollama/ollama, but look around in case the layout changes
  const dir = layout(dataDir).ollama;
  const candidates = [path.join(dir, "ollama"), path.join(dir, "bin", "ollama")];
  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) || null;
}

async function startOllama(dataDir) {
  const binary = findOllama(dataDir);
  if (!binary) throw new Error("Buddy's AI engine isn't downloaded yet.");
  const dirs = layout(dataDir);
  fs.mkdirSync(dirs.ollamaHome, { recursive: true });
  start("ollama", binary, ["serve"], {
    dataDir,
    env: {
      ...process.env,
      OLLAMA_HOST: `127.0.0.1:${OLLAMA_PORT}`,
      OLLAMA_MODELS: dirs.ollamaModels,
      // Ollama keeps a key and history in ~/.ollama, point "home" into the Buddy folder
      HOME: dirs.ollamaHome,
    },
  });
  await waitFor(`${OLLAMA_URL}/api/version`, 30);
}

function backendCommand() {
  if (app.isPackaged) {
    // run it from its own folder, so Piper can use a short relative path to its data
    const backendDir = path.join(process.resourcesPath, "backend");
    return { command: path.join(backendDir, "buddy-backend"), args: [], cwd: backendDir };
  }
  // while developing, run the Python backend straight from the repo
  const backendDir = path.join(__dirname, "..", "..", "backend");
  return { command: process.env.BUDDY_PYTHON || "python3", args: ["run.py"], cwd: backendDir };
}

function frontendDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "frontend")
    : path.join(__dirname, "..", "..", "frontend", "dist");
}

async function startBackend(dataDir) {
  const port = await freePort();
  const { command, args, cwd } = backendCommand();
  start("backend", command, args, {
    dataDir,
    cwd,
    env: {
      ...process.env,
      BUDDY_DATA_DIR: dataDir,
      BUDDY_PORT: String(port),
      OLLAMA_URL,
      VOICE_ENGINE: "local",
      FRONTEND_DIR: frontendDir(),
      ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
    },
  });
  const url = `http://127.0.0.1:${port}`;
  await waitFor(`${url}/health`, 90);
  return url;
}

async function startAll(dataDir) {
  await startOllama(dataDir);
  return startBackend(dataDir);
}

function stopAll() {
  for (const child of running.splice(0)) {
    if (child.exitCode === null) child.kill();
  }
}

module.exports = { OLLAMA_URL, startOllama, startBackend, startAll, stopAll, findOllama };
