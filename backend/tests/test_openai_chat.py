import asyncio
from types import SimpleNamespace

import openai
import pytest

try:
    import httpx2 as httpx  # newer OpenAI SDKs
except ImportError:
    import httpx

from app.providers.base import ProviderError
from app.providers.openai_chat import ErrorText, OpenAIChat


def chunk(text):
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text))])


class FakeCompletions:
    def __init__(self, error=None):
        self.error = error
        self.request = None

    async def create(self, **request):
        self.request = request
        if self.error:
            raise self.error

        async def stream():
            for text in ["Hello", " there", None, "!"]:
                yield chunk(text)

        return stream()


def fake_client(completions):
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    return lambda: client


def collect(chat):
    async def run():
        return "".join([part async for part in chat.stream("be nice", [{"role": "user", "content": "hi"}])])

    return asyncio.run(run())


def test_streams_text_and_sends_system_prompt():
    completions = FakeCompletions()
    assert collect(OpenAIChat("some-model", fake_client(completions))) == "Hello there!"
    assert completions.request["model"] == "some-model"
    assert completions.request["messages"][0] == {"role": "system", "content": "be nice"}


def test_errors_become_friendly_messages():
    request = httpx.Request("POST", "http://localhost")
    error = openai.APIConnectionError(request=request)
    chat = OpenAIChat("llama", fake_client(FakeCompletions(error)), name="Ollama",
                      errors=ErrorText(offline="Can't reach {name}, is it running?"))

    with pytest.raises(ProviderError, match="Can't reach Ollama, is it running?"):
        collect(chat)


def test_missing_model_names_the_model():
    request = httpx.Request("POST", "http://localhost")
    error = openai.NotFoundError("nope", response=httpx.Response(404, request=request), body=None)
    chat = OpenAIChat("llama3.2:3b", fake_client(FakeCompletions(error)), name="Ollama",
                      errors=ErrorText(not_found="Run: ollama pull {model}"))

    with pytest.raises(ProviderError, match="ollama pull llama3.2:3b"):
        collect(chat)


def test_a_wrong_key_says_so():
    # Gemini answers a wrong key with 400 instead of 401
    request = httpx.Request("POST", "http://localhost")
    error = openai.BadRequestError("Invalid Auth key.", response=httpx.Response(400, request=request), body=None)
    chat = OpenAIChat("gemini-3.5-flash-lite", fake_client(FakeCompletions(error)), name="Gemini",
                      errors=ErrorText(bad_key="Check your {name} key"))

    with pytest.raises(ProviderError, match="Check your Gemini key"):
        collect(chat)
