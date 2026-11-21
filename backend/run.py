"""Starts the backend. This is what the desktop app runs (and what gets bundled)."""

import os

import uvicorn

from app.main import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("BUDDY_PORT", "8000")), log_level="info")
