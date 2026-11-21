import asyncio

import pytest

from app import providers
from app.providers import FreeSpeech, get_speech, listens_in_browser
from app.providers.base import ProviderError


def test_without_a_voice_the_browser_speaks(monkeypatch, tmp_path):
    monkeypatch.setattr(providers.settings, "voices_dir", str(tmp_path))
    audio, audio_format = asyncio.run(FreeSpeech().speak("Hello!"))
    assert (audio, audio_format) == (b"", "browser")


def test_free_setup_listens_in_the_browser():
    with pytest.raises(ProviderError, match="browser does the listening"):
        asyncio.run(FreeSpeech().transcribe(b"audio"))


def test_picking_the_speech_engine(monkeypatch):
    monkeypatch.setattr(providers.settings, "demo_mode", False)
    assert isinstance(get_speech(), FreeSpeech)
    assert listens_in_browser()

    monkeypatch.setattr(providers.settings, "voice_engine", "openai")
    assert get_speech().__class__.__name__ == "OpenAISpeech"
    assert not listens_in_browser()


def test_ready_says_where_listening_happens(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "hello"})
        assert ws.receive_json()["listen"] == "server"  # demo mode fakes the listening on the server
