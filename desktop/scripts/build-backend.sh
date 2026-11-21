#!/bin/sh
# Bundles the Python backend into a standalone folder (no Python needed on the user's Mac).
# Run from the desktop folder: ./scripts/build-backend.sh
set -e

cd "$(dirname "$0")/../../backend"
OUT="../desktop/build"

python -m PyInstaller run.py \
  --name buddy-backend \
  --onedir \
  --noconfirm \
  --distpath "$OUT" \
  --workpath "$OUT/pyinstaller" \
  --specpath "$OUT/pyinstaller" \
  --collect-submodules app \
  --collect-all piper \
  --collect-all faster_whisper \
  --collect-all ctranslate2 \
  --collect-all onnxruntime \
  --collect-submodules uvicorn \
  --hidden-import websockets.legacy.server \
  --exclude-module tkinter

echo "Backend bundled into desktop/build/buddy-backend"
