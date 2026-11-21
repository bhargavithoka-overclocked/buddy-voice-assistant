"""Ollama: open models running on your own computer. Free, private, works offline."""

import openai

from ..config import settings
from .openai_chat import ErrorText

OLLAMA_ERRORS = ErrorText(
    no_key="Ollama isn't set up. Open Settings to see how to install it.",
    not_found="The local model {model} isn't downloaded yet. Run: ollama pull {model}",
    offline="I can't reach Ollama on this computer. Open the Ollama app (or run `ollama serve`) and try again.",
)

_client = None


def get_ollama_client() -> openai.AsyncOpenAI:
    global _client
    if _client is None:
        # Ollama speaks the OpenAI API and ignores the key, but the SDK wants one
        _client = openai.AsyncOpenAI(
            base_url=f"{settings.ollama_url.rstrip('/')}/v1",
            api_key="ollama",
            max_retries=0,  # it's on this machine, if it's not answering, retrying won't help
        )
    return _client
