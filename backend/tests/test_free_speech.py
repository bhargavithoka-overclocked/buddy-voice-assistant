import asyncio

import pytest

from app import providers
from app.providers import FreeSpeech, get_speech, listens_in_browser
from app.providers.base import ProviderError
from app.providers.piper_voice import espeak_data_dir


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


def test_espeak_gets_a_short_enough_path(monkeypatch, tmp_path):
    short = str(tmp_path / "espeak-ng-data")
    assert espeak_data_dir(short) == short

    # a long path (like the app opened from a deep folder) becomes relative to where we run
    deep = tmp_path / ("folder-" * 25) / "espeak-ng-data"
    deep.parent.mkdir()
    monkeypatch.chdir(deep.parent)
    assert espeak_data_dir(str(deep)) == "espeak-ng-data"


def test_espeak_path_too_long_either_way(monkeypatch, tmp_path):
    deep = tmp_path / ("folder-" * 25) / "espeak-ng-data"
    monkeypatch.chdir(tmp_path.parent)  # still a long way from the data
    assert espeak_data_dir(str(deep)) is None
