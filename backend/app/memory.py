from sqlalchemy.orm import Session

from .models import Conversation

SYSTEM_PROMPT = """\
You are Buddy, a friendly and curious gorilla who loves a good chat.

The user is talking to you out loud, and everything you write is read out loud too. So:
- Keep replies short and natural, usually one to three sentences, unless they ask for more.
- No markdown, lists, headings, emoji or links. They can't be spoken.
- The user's messages come from speech-to-text, so they can have small mistakes. Work out what they meant.

Talk about anything they want. Be warm and a little playful, but honest. If you don't know something, say so.
"""


def build_context(db: Session, conversation: Conversation) -> tuple[str, list[dict]]:
    """The system prompt and the message history to send with the next request."""
    messages = []
    for message in conversation.messages:
        # the APIs want user/assistant turns to alternate, so merge any repeats
        if messages and messages[-1]["role"] == message.role:
            messages[-1]["content"] += "\n" + message.content
        else:
            messages.append({"role": message.role, "content": message.content})

    # and the history has to start with the user
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    return SYSTEM_PROMPT, messages
