import asyncio
import base64
import io
import wave
from types import SimpleNamespace

import numpy as np
import pytest

from app import providers
from app.providers import LocalSpeech, get_speech, listens_in_browser
from app.providers.base import ProviderError
from app.providers.whisper_speech import wav_to_samples
from app.wake import is_wake_phrase


def make_wav(seconds=0.5, rate=48000, channels=2):
    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(b"\x00\x10" * int(seconds * rate) * channels)
    return out.getvalue()


def test_wav_to_samples_resamples_to_16k_mono():
    samples = wav_to_samples(make_wav(seconds=0.5, rate=48000, channels=2))
    assert samples.dtype == np.float32
    assert len(samples) == 8000


def test_transcribe_with_a_fake_whisper():
    speech = LocalSpeech()
    seen = {}

    def transcribe(samples, **options):
        seen["samples"] = len(samples)
        return [SimpleNamespace(text=" Hey Buddy,"), SimpleNamespace(text=" how are you? ")], None

    speech._model_loaded = True
    speech._model = SimpleNamespace(transcribe=transcribe)

    assert asyncio.run(speech.transcribe(make_wav(rate=16000, channels=1))) == "Hey Buddy, how are you?"
    assert seen["samples"] == 8000


def test_missing_whisper_model(monkeypatch, tmp_path):
    monkeypatch.setattr(providers.settings, "whisper_dir", str(tmp_path))
    with pytest.raises(ProviderError, match="isn't downloaded yet"):
        asyncio.run(LocalSpeech().transcribe(make_wav()))


def test_local_engine(monkeypatch):
    monkeypatch.setattr(providers.settings, "demo_mode", False)
    monkeypatch.setattr(providers.settings, "voice_engine", "local")
    assert isinstance(get_speech(), LocalSpeech)
    assert not listens_in_browser()  # the app sends audio to the server instead


def test_wake_phrase():
    for text in ["Hey Buddy", "hi, buddy!", "okay bud", "Hey budy what's up"]:
        assert is_wake_phrase(text), text
    for text in ["buddy", "everybody", "hello there", "they buddied up"]:
        assert not is_wake_phrase(text), text


def test_wake_check_over_the_websocket(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "hello"})
        ws.receive_json()
        # demo mode's fake transcriber always "hears" "Hey Buddy, how are you doing today?"
        ws.send_json({"type": "wake_check", "data": base64.b64encode(b"audio").decode()})
        assert ws.receive_json()["type"] == "wake"
