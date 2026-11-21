import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app import providers
from app.routers import settings as settings_router


@pytest.fixture
def no_keys(monkeypatch, tmp_path):
    for name in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(settings_router, "ANT_PROFILE_DIR", tmp_path / "missing")
    monkeypatch.setattr(providers.settings, "ollama_url", "http://127.0.0.1:9")  # nothing running


@pytest.fixture
def fake_ollama(monkeypatch):
    """A tiny stand-in for Ollama that says it has only llama3.2:3b."""

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps({"models": [{"name": "llama3.2:3b"}]}).encode()
            self.send_response(200)
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setattr(providers.settings, "ollama_url", f"http://127.0.0.1:{server.server_port}")
    yield
    server.shutdown()


def test_status_without_anything_set_up(client, no_keys):
    status = client.get("/api/settings").json()

    assert status["demo_mode"] is True
    assert status["ollama"]["connected"] is False
    assert status["ollama"]["missing"] == ["llama3.2:3b", "llama3.1:8b"]
    for provider in ("gemini", "claude", "openai"):
        assert status[provider]["connected"] is False
    assert status["claude"]["models"]["fast"] == "claude-haiku-5-5"


def test_ollama_running_but_missing_a_model(client, fake_ollama):
    ollama = client.get("/api/settings").json()["ollama"]
    assert ollama["connected"] is True
    assert ollama["missing"] == ["llama3.1:8b"]


def test_finds_keys_from_the_environment(client, no_keys, monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("GEMINI_API_KEY", "gm-test")
    monkeypatch.setattr(settings_router, "ANT_PROFILE_DIR", tmp_path)  # exists

    status = client.get("/api/settings").json()

    assert status["openai"]["source"] == "environment variable"
    assert status["gemini"]["source"] == "environment variable"
    assert status["claude"]["source"] == "ant CLI login (ant auth login)"
    # the keys themselves are never sent back
    assert "sk-test" not in str(status) and "gm-test" not in str(status)


def test_voice_status(client, monkeypatch, tmp_path):
    monkeypatch.setattr(providers.settings, "voices_dir", str(tmp_path))
    voice = client.get("/api/settings").json()["voice"]
    assert voice["engine"] == "free"
    assert voice["piper_installed"] is False
    assert voice["voice"] == "your browser's voice"

    (tmp_path / "en_US-ryan-medium.onnx").write_bytes(b"")
    assert client.get("/api/settings").json()["voice"]["piper_installed"] is True


def test_connection_check(client):
    assert client.post("/api/settings/test/ollama").json() == {"ok": True, "message": "Connected!"}
    assert client.post("/api/settings/test/skynet").status_code == 404


def test_voice_status_for_each_engine(client, monkeypatch):
    monkeypatch.setattr(providers.settings, "demo_mode", False)

    monkeypatch.setattr(providers.settings, "voice_engine", "local")
    voice = client.get("/api/settings").json()["voice"]
    assert (voice["engine"], voice["listening"]) == ("local", "Whisper on this computer")

    monkeypatch.setattr(providers.settings, "voice_engine", "free")
    assert client.get("/api/settings").json()["voice"]["listening"] == "your browser"
