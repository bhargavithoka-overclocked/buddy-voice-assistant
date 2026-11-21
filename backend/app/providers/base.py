from typing import AsyncIterator, Protocol


class ProviderError(Exception):
    """A problem Buddy should tell the user about, like a missing API key."""


class ChatModel(Protocol):
    def stream(self, system: str, messages: list[dict]) -> AsyncIterator[str]:
        """Yield the reply a few words at a time."""

    async def complete(self, system: str, messages: list[dict]) -> str:
        """Return the whole reply at once (for small background jobs)."""
