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
    assert get_chat("ollama", "fast").model == "llama3.2:3b"
    assert get_chat("ollama", "smart").name == "Ollama"
    with pytest.raises(ValueError):
        get_chat("skynet", "fast")


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


def test_ollama_not_running(monkeypatch):
    from app import providers
    from app.providers import local
    from app.providers.base import ProviderError

    monkeypatch.setattr(providers.settings, "demo_mode", False)
    monkeypatch.setattr(providers.settings, "ollama_url", "http://127.0.0.1:9")  # nothing listens here
    monkeypatch.setattr(local, "_client", None)

    chat = get_chat("ollama", "fast")
    with pytest.raises(ProviderError, match="can't reach Ollama"):
        asyncio.run(collect(chat.stream("hi", [{"role": "user", "content": "hi"}])))
    monkeypatch.setattr(local, "_client", None)


def test_gemini_never_borrows_the_openai_key(monkeypatch):
    from app import providers
    from app.providers import gemini
    from app.providers.base import ProviderError

    monkeypatch.setattr(providers.settings, "demo_mode", False)
    monkeypatch.setattr(providers.settings, "gemini_api_key", None)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-not-for-google")
    monkeypatch.setattr(gemini, "_client", None)

    chat = get_chat("gemini", "fast")
    assert chat.model == "gemini-3.5-flash-lite"
    with pytest.raises(ProviderError, match="free Gemini key"):
        asyncio.run(collect(chat.stream("hi", [{"role": "user", "content": "hi"}])))
