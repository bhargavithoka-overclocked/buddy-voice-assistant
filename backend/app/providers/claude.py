from contextlib import asynccontextmanager

import anthropic

from ..config import settings
from .base import ProviderError

# models that support server-side refusal fallbacks: if one declines a
# request, the API reruns it on a fallback model instead of just stopping
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-2", "claude-fable-5-1"}

_client = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        # with no key set, the SDK falls back to ANTHROPIC_API_KEY or an `ant auth login` profile
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key or None)
    return _client


@asynccontextmanager
async def friendly_errors():
    try:
        yield
    except anthropic.AuthenticationError as e:
        raise ProviderError("Claude isn't connected. Open Settings to see how to add your Anthropic key.") from e
    except anthropic.NotFoundError as e:
        raise ProviderError("That Claude model wasn't found. Check the model names in your .env file.") from e
    except anthropic.RateLimitError as e:
        raise ProviderError("Claude is getting too many requests right now. Try again in a moment.") from e
    except anthropic.APIConnectionError as e:
        raise ProviderError("I can't reach Claude. Check your internet connection.") from e
    except anthropic.APIStatusError as e:
        raise ProviderError(f"Claude returned an error ({e.status_code}). Try again in a moment.") from e
    except anthropic.AnthropicError as e:
        # e.g. no credentials found at all
        raise ProviderError("Claude isn't set up yet. Open Settings to see how to add your Anthropic key.") from e


class ClaudeChat:
    def __init__(self, model: str):
        self.model = model

    def _open_stream(self, system: str, messages: list[dict], max_tokens: int):
        request = dict(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
            # caches the conversation so far, so each new turn only pays for the new part
            cache_control={"type": "ephemeral"},
            # low effort keeps replies quick, which matters a lot for voice
            output_config={"effort": "low"},
        )
        client = get_client()
        if self.model in FALLBACK_MODELS:
            return client.beta.messages.stream(
                **request, betas=["server-side-fallback-2026-07-01"], fallbacks="default"
            )
        return client.messages.stream(**request)

    async def stream(self, system: str, messages: list[dict]):
        async with friendly_errors():
            async with self._open_stream(system, messages, max_tokens=4096) as stream:
                async for text in stream.text_stream:
                    yield text
                final = await stream.get_final_message()
        if final.stop_reason == "refusal":
            yield " Sorry, that's not something I can help with."

    async def complete(self, system: str, messages: list[dict]) -> str:
        parts = [text async for text in self.stream(system, messages)]
        return "".join(parts)
