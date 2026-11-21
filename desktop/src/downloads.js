const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { layout } = require("./paths");

const OLLAMA_VERSION = "v0.40.17";
const PIPER_VOICE = "en_US-ryan-medium";
const WHISPER_MODEL = "base.en";

const HF = "https://huggingface.co";
const GB = 1e9;
const MB = 1e6;

// Everything the setup can download. Sizes are approximate, for showing the user.
const ITEMS = [
  {
    id: "engine",
    name: "AI engine (Ollama)",
    from: "github.com/ollama",
    size: 178 * MB,
    files: [
      {
        url: `https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/ollama-darwin.tgz`,
        to: (dirs) => path.join(dirs.ollama, "ollama-darwin.tgz"),
        unpackTo: (dirs) => dirs.ollama,
      },
    ],
    isInstalled: (dirs) => ["ollama", "bin/ollama"].some((f) => fs.existsSync(path.join(dirs.ollama, f))),
  },
  {
    id: "voice",
    name: "Buddy's voice (Piper)",
    from: "huggingface.co/rhasspy",
    size: 63 * MB,
    files: [".onnx", ".onnx.json"].map((ext) => ({
      url: `${HF}/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/${PIPER_VOICE}${ext}`,
      to: (dirs) => path.join(dirs.voices, `${PIPER_VOICE}${ext}`),
    })),
    isInstalled: (dirs) => fs.existsSync(path.join(dirs.voices, `${PIPER_VOICE}.onnx`)),
  },
  {
    id: "hearing",
    name: "Speech recognition (Whisper)",
    from: "huggingface.co/Systran",
    size: 145 * MB,
    files: ["config.json", "tokenizer.json", "vocabulary.txt", "model.bin"].map((file) => ({
      url: `${HF}/Systran/faster-whisper-${WHISPER_MODEL}/resolve/main/${file}`,
      to: (dirs) => path.join(dirs.whisper, WHISPER_MODEL, file),
    })),
    isInstalled: (dirs) => fs.existsSync(path.join(dirs.whisper, WHISPER_MODEL, "model.bin")),
  },
  {
    id: "fast-model",
    name: "AI model, Fast (llama3.2:3b)",
    from: "ollama.com/library",
    size: 2.0 * GB,
    model: "llama3.2:3b",
  },
  {
    id: "smart-model",
    name: "AI model, Smart (llama3.1:8b)",
    from: "ollama.com/library",
    size: 4.9 * GB,
    model: "llama3.1:8b",
    optional: true,
    note: "Works best with 16 GB of memory or more. Gemini's free tier is a good Smart option otherwise.",
  },
];

function modelInstalled(dirs, model) {
  const [name, tag = "latest"] = model.split(":");
  return fs.existsSync(path.join(dirs.ollamaModels, "manifests", "registry.ollama.ai", "library", name, tag));
}

/** What would be downloaded into dataDir, and whether each part is already there. */
function plan(dataDir) {
  const dirs = layout(dataDir);
  const memoryGB = Math.round(os.totalmem() / GB);
  return ITEMS.map(({ files, isInstalled, ...item }) => ({
    ...item,
    installed: item.model ? modelInstalled(dirs, item.model) : isInstalled(dirs),
    // only suggest the big model on machines that can run it
    recommended: !item.optional || memoryGB >= 16,
  }));
}

async function freeSpace(folder) {
  // the folder may not exist yet, so check the closest parent that does
  let dir = folder;
  while (!fs.existsSync(dir)) dir = path.dirname(dir);
  const stats = await fs.promises.statfs(dir);
  return stats.bavail * stats.bsize;
}

async function downloadFile(url, destination, onBytes) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);

  // write to a .part file first so a cancelled download never looks finished
  const partial = `${destination}.part`;
  const body = Readable.fromWeb(response.body);
  body.on("data", (chunk) => onBytes(chunk.length));
  await pipeline(body, fs.createWriteStream(partial));
  fs.renameSync(partial, destination);
}

function untar(file, folder) {
  return new Promise((resolve, reject) => {
    const tar = spawn("tar", ["-xzf", file, "-C", folder]);
    tar.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Couldn't unpack ${path.basename(file)}`))));
  });
}

async function downloadFiles(item, dirs, report) {
  const { files } = ITEMS.find((i) => i.id === item.id);
  let done = 0;
  for (const file of files) {
    const destination = file.to(dirs);
    await downloadFile(file.url, destination, (bytes) => {
      done += bytes;
      report({ done, total: item.size });
    });
    if (file.unpackTo) {
      report({ done, total: item.size, status: "Unpacking..." });
      await untar(destination, file.unpackTo(dirs));
      fs.rmSync(destination);
    }
  }
}

/** Download a model through Ollama's own API, which streams its progress. */
async function pullModel(ollamaUrl, model, report) {
  const response = await fetch(`${ollamaUrl}/api/pull`, {
    method: "POST",
    body: JSON.stringify({ model, stream: true }),
  });
  if (!response.ok) throw new Error(`Couldn't download ${model} (${response.status})`);

  const layers = new Map(); // a model is downloaded in several parts
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += Buffer.from(chunk).toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines.filter(Boolean)) {
      const update = JSON.parse(line);
      if (update.error) throw new Error(update.error);
      if (update.digest && update.total) layers.set(update.digest, update);
      const done = [...layers.values()].reduce((sum, l) => sum + (l.completed || 0), 0);
      const total = [...layers.values()].reduce((sum, l) => sum + l.total, 0);
      report({ done, total: total || 1, status: update.status === "success" ? "Done" : undefined });
    }
  }
}

module.exports = { ITEMS, plan, freeSpace, downloadFiles, pullModel };
