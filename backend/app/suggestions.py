import re

from .providers import ChatModel, ProviderError

FOLLOW_UP_PROMPT = """\
You suggest what the user could say next to Buddy, a voice assistant.
Read the end of the conversation and write 3 short follow-ups in the user's own voice,
like "Tell me more about that" or "What about in winter?". Under 8 words each.
One per line, nothing else.
"""


def parse_suggestions(text: str, limit: int = 3) -> list[str]:
    suggestions = []
    for line in text.splitlines():
        # models love to number things even when asked not to
        line = re.sub(r'^\s*(?:[-*•]|\d+[.)])\s*', "", line).strip().strip('"')
        if line and len(line) <= 80 and line.lower() not in (s.lower() for s in suggestions):
            suggestions.append(line)
    return suggestions[:limit]


async def suggest_follow_ups(chat: ChatModel, history: list[dict]) -> list[str]:
    transcript = "\n".join(
        f"{'User' if m['role'] == 'user' else 'Buddy'}: {m['content']}" for m in history[-6:]
    )
    try:
        text = await chat.complete(FOLLOW_UP_PROMPT, [{"role": "user", "content": transcript}])
    except ProviderError:
        return []  # suggestions are a nice extra, not worth an error message
    return parse_suggestions(text)
