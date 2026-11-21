"""Google Gemini's free tier, through its OpenAI-compatible endpoint."""

import os

import openai

from ..config import settings
from .base import ProviderError
from .openai_chat import ErrorText

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

GEMINI_ERRORS = ErrorText(
    no_key="Gemini isn't connected. Open Settings to see how to get a free Gemini key.",
    not_found="The Gemini model {model} wasn't found. Check GEMINI_FAST_MODEL and GEMINI_SMART_MODEL in your .env file.",
)

_client = None


def gemini_key() -> str | None:
    return settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")


def get_gemini_client() -> openai.AsyncOpenAI:
    global _client
    key = gemini_key()
    if not key:
        # without this the OpenAI SDK would quietly use OPENAI_API_KEY and send it to Google
        raise ProviderError(GEMINI_ERRORS.no_key)
    if _client is None:
        _client = openai.AsyncOpenAI(base_url=GEMINI_URL, api_key=key)
    return _client
