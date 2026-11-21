import asyncio
import io
import wave

import pytest

from app.providers import get_chat, get_speech
from app.providers.claude import ClaudeChat
from app.providers.fake import FakeChat, beep_speech


def test_demo_mode_uses_fakes():
    assert isinstance(get_chat("claude", "fast"), FakeChat)
    assert get_speech().__class__.__name__ == "FakeSpeech"


def test_picks_model_by_mode(monkeypatch):
    from app import providers

    monkeypatch.setattr(providers.settings, "demo_mode", False)
    assert get_chat("claude", "fast").model == providers.settings.claude_fast_model
    assert get_chat("claude", "smart").model == providers.settings.claude_smart_model
    assert get_chat("openai", "smart").model == providers.settings.openai_smart_model
    assert isinstance(get_chat("claude", "smart"), ClaudeChat)
    with pytest.raises(ValueError):
        get_chat("gemini", "fast")


async def collect(stream):
    return "".join([part async for part in stream])


def test_fake_chat_streams_a_reply():
    reply = asyncio.run(collect(FakeChat(delay=0).stream("be nice", [{"role": "user", "content": "hello"}])))
    assert '"hello"' in reply


def test_beep_speech_is_a_valid_wav():
    audio = beep_speech("one two three four")
    with wave.open(io.BytesIO(audio)) as wav:
        assert wav.getnchannels() == 1
        assert wav.getframerate() == 16000
        assert wav.getnframes() == 16000  # 4 words * 0.25s
