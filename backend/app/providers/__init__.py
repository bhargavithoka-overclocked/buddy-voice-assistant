from ..config import settings
from .base import ChatModel, ProviderError  # noqa: F401
from .claude import ClaudeChat
from .fake import FakeChat, FakeSpeech
from .gemini import GEMINI_ERRORS, get_gemini_client
from .local import OLLAMA_ERRORS, get_ollama_client
from .openai_chat import OpenAIChat
from .piper_voice import FreeSpeech
from .speech import OpenAISpeech

PROVIDERS = ("ollama", "gemini", "claude", "openai")
MODES = ("fast", "smart")


def get_chat(provider: str, mode: str) -> ChatModel:
    if settings.demo_mode:
        return FakeChat()
    if provider == "ollama":
        model = settings.ollama_smart_model if mode == "smart" else settings.ollama_fast_model
        return OpenAIChat(model, get_ollama_client, name="Ollama", errors=OLLAMA_ERRORS)
    if provider == "gemini":
        model = settings.gemini_smart_model if mode == "smart" else settings.gemini_fast_model
        return OpenAIChat(model, get_gemini_client, name="Gemini", errors=GEMINI_ERRORS)
    if provider == "claude":
        return ClaudeChat(settings.claude_smart_model if mode == "smart" else settings.claude_fast_model)
    if provider == "openai":
        return OpenAIChat(settings.openai_smart_model if mode == "smart" else settings.openai_fast_model)
    raise ValueError(f"unknown provider {provider!r}")


_free_speech = FreeSpeech()  # one copy, so the voice model is only loaded once


def get_speech():
    if settings.demo_mode:
        return FakeSpeech()
    if settings.voice_engine == "openai":
        return OpenAISpeech()
    return _free_speech


def listens_in_browser() -> bool:
    """With the free setup the browser turns speech into text, not the server."""
    return not settings.demo_mode and settings.voice_engine != "openai"
