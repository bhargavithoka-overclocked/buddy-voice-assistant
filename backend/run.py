"""Starts the backend. This is what the desktop app runs (and what gets bundled)."""

import multiprocessing
import os

import uvicorn

from app.main import app

if __name__ == "__main__":
    # in the bundled app, a library starting a helper process re-runs this file.
    # Without this the helper would try to start a second server on the same port.
    multiprocessing.freeze_support()
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("BUDDY_PORT", "8000")), log_level="info")
