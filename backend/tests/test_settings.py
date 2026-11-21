from app.routers import settings as settings_router


def test_status_without_any_keys(client, monkeypatch, tmp_path):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr(settings_router, "ANT_PROFILE_DIR", tmp_path / "missing")

    status = client.get("/api/settings").json()

    assert status["demo_mode"] is True
    assert status["claude"]["connected"] is False
    assert status["openai"]["connected"] is False
    assert status["claude"]["models"]["fast"] == "claude-haiku-5-5"


def test_finds_keys_from_the_environment(client, monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(settings_router, "ANT_PROFILE_DIR", tmp_path)  # exists

    status = client.get("/api/settings").json()

    assert status["openai"] == {**status["openai"], "connected": True, "source": "environment variable"}
    assert status["claude"]["source"] == "ant CLI login (ant auth login)"
    # the key itself is never sent back
    assert "sk-test" not in str(status)


def test_connection_check(client):
    assert client.post("/api/settings/test/claude").json() == {"ok": True, "message": "Connected!"}
    assert client.post("/api/settings/test/gemini").status_code == 404
