from contextlib import asynccontextmanager
from dataclasses import dataclass

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


@dataclass
class ErrorText:
    """What to tell the user when something goes wrong. {name} and {model} get filled in."""

    no_key: str = "{name} isn't connected. Open Settings to see how to add your OpenAI key."
    not_found: str = "The {name} model {model} wasn't found. Check the model names in your .env file."
    offline: str = "I can't reach {name}. Check your internet connection."
    bad_key: str = "{name} didn't accept your API key. Check it's copied correctly, then restart Buddy."


@asynccontextmanager
async def friendly_errors(name: str = "ChatGPT", model: str = "", text: ErrorText = ErrorText()):
    def say(template):
        return ProviderError(template.format(name=name, model=model))

    try:
        yield
    except ProviderError:
        raise
    except openai.AuthenticationError as e:
        raise say(text.no_key) from e
    except openai.NotFoundError as e:
        raise say(text.not_found) from e
    except openai.BadRequestError as e:
        # Gemini answers a wrong key with 400 instead of 401
        if "key" in str(e).lower():
            raise say(text.bad_key) from e
        raise ProviderError(f"{name} returned an error ({e.status_code}). Try again in a moment.") from e
    except openai.RateLimitError as e:
        raise ProviderError(f"{name} is getting too many requests right now. Try again in a moment.") from e
    except openai.APIConnectionError as e:
        raise say(text.offline) from e
    except openai.APIStatusError as e:
        raise ProviderError(f"{name} returned an error ({e.status_code}). Try again in a moment.") from e
    except openai.OpenAIError as e:
        # raised when there's no API key at all
        raise say(text.no_key) from e


class OpenAIChat:
    """
    Chat for anything that speaks the OpenAI API. That's ChatGPT itself, but
    also Ollama and Gemini, which both offer an OpenAI-compatible endpoint.
    """

    def __init__(self, model: str, client=get_client, name: str = "ChatGPT", errors: ErrorText = ErrorText()):
        self.model = model
        self.client = client
        self.name = name
        self.errors = errors

    async def stream(self, system: str, messages: list[dict]):
        async with friendly_errors(self.name, self.model, self.errors):
            response = await self.client().chat.completions.create(
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
