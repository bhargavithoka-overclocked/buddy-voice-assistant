from contextlib import asynccontextmanager

import openai

from ..config import settings
from .base import ProviderError

_client = None


def get_client() -> openai.AsyncOpenAI:
    global _client
    if _client is None:
        # with no key in .env the SDK still checks the OPENAI_API_KEY environment variable
        _client = openai.AsyncOpenAI(api_key=settings.openai_api_key or None)
    return _client


@asynccontextmanager
async def friendly_errors(what: str = "ChatGPT"):
    try:
        yield
    except openai.AuthenticationError as e:
        raise ProviderError(f"{what} isn't connected. Open Settings to see how to add your OpenAI key.") from e
    except openai.NotFoundError as e:
        raise ProviderError(f"That {what} model wasn't found. Check the model names in your .env file.") from e
    except openai.RateLimitError as e:
        raise ProviderError(f"{what} is getting too many requests right now. Try again in a moment.") from e
    except openai.APIConnectionError as e:
        raise ProviderError(f"I can't reach {what}. Check your internet connection.") from e
    except openai.APIStatusError as e:
        raise ProviderError(f"{what} returned an error ({e.status_code}). Try again in a moment.") from e
    except openai.OpenAIError as e:
        # raised when there's no API key at all
        raise ProviderError(f"{what} isn't set up yet. Open Settings to see how to add your OpenAI key.") from e


class OpenAIChat:
    def __init__(self, model: str):
        self.model = model

    async def stream(self, system: str, messages: list[dict]):
        async with friendly_errors():
            response = await get_client().chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": system}, *messages],
                stream=True,
            )
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

    async def complete(self, system: str, messages: list[dict]) -> str:
        parts = [text async for text in self.stream(system, messages)]
        return "".join(parts)
