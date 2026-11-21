from ..config import settings
from .base import ChatModel, ProviderError  # noqa: F401
from .claude import ClaudeChat
from .fake import FakeChat, FakeSpeech
from .local import OLLAMA_ERRORS, get_ollama_client
from .openai_chat import OpenAIChat
from .speech import OpenAISpeech

PROVIDERS = ("ollama", "claude", "openai")
MODES = ("fast", "smart")


def get_chat(provider: str, mode: str) -> ChatModel:
    if settings.demo_mode:
        return FakeChat()
    if provider == "ollama":
        model = settings.ollama_smart_model if mode == "smart" else settings.ollama_fast_model
        return OpenAIChat(model, get_ollama_client, name="Ollama", errors=OLLAMA_ERRORS)
    if provider == "claude":
        return ClaudeChat(settings.claude_smart_model if mode == "smart" else settings.claude_fast_model)
    if provider == "openai":
        return OpenAIChat(settings.openai_smart_model if mode == "smart" else settings.openai_fast_model)
    raise ValueError(f"unknown provider {provider!r}")


def get_speech():
    return FakeSpeech() if settings.demo_mode else OpenAISpeech()
