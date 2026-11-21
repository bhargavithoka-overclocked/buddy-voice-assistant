from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import serve_frontend


def test_everything_goes_in_the_data_folder(tmp_path):
    settings = Settings(data_dir=str(tmp_path), _env_file=None)
    assert settings.database_url == f"sqlite:///{tmp_path / 'buddy.db'}"
    assert settings.voices_dir == str(tmp_path / "voices")
    assert settings.whisper_dir == str(tmp_path / "whisper")


def test_keys_are_read_from_the_data_folder(tmp_path):
    (tmp_path / "buddy.env").write_text("GEMINI_API_KEY=from-the-folder\n")
    settings = Settings(data_dir=str(tmp_path), _env_file=tmp_path / "buddy.env")
    assert settings.gemini_api_key == "from-the-folder"


def test_serves_the_built_frontend(tmp_path):
    (tmp_path / "index.html").write_text("<div id='root'></div>")
    app = FastAPI()

    @app.get("/health")
    def health():
        return {"status": "ok"}

    serve_frontend(app, str(tmp_path))
    client = TestClient(app)
    assert "root" in client.get("/").text
    assert client.get("/health").json() == {"status": "ok"}
