from sqlalchemy.orm import Session

from .models import Conversation, Message
from .providers import ChatModel, ProviderError

# once there are more than this many unsummarised messages, the older ones get summarised...
SUMMARIZE_AFTER = 30
# ...except for the most recent few, which are always sent word for word
KEEP_RECENT = 10

SUMMARY_PROMPT = """You summarise conversations between a user and Buddy, a voice assistant.
Write a short summary (under 150 words) that keeps anything worth remembering:
names, facts about the user, preferences, plans and open questions.
If there's a previous summary, merge it in. Plain text only.
"""

SYSTEM_PROMPT = """\
You are Buddy, a friendly and curious gorilla who loves a good chat.

The user is talking to you out loud, and everything you write is read out loud too. So:
- Keep replies short and natural, usually one to three sentences, unless they ask for more.
- No markdown, lists, headings, emoji or links. They can't be spoken.
- The user's messages come from speech-to-text, so they can have small mistakes. Work out what they meant.

Talk about anything they want. Be warm and a little playful, but honest. If you don't know something, say so.
"""


def unsummarized(conversation: Conversation) -> list[Message]:
    return [m for m in conversation.messages if m.id > conversation.summarized_upto]


def build_context(db: Session, conversation: Conversation) -> tuple[str, list[dict]]:
    """The system prompt and the message history to send with the next request."""
    system = SYSTEM_PROMPT
    if conversation.summary:
        system += f"\nWhat you talked about earlier in this chat:\n{conversation.summary}\n"

    messages = []
    for message in unsummarized(conversation):
        content = message.content
        if message.interrupted:
            # so the model knows it didn't get to finish
            content += " [the user interrupted you here]"

        # the APIs want user/assistant turns to alternate, so merge any repeats
        if messages and messages[-1]["role"] == message.role:
            messages[-1]["content"] += "\n" + content
        else:
            messages.append({"role": message.role, "content": content})

    # and the history has to start with the user
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    return system, messages


async def maybe_summarize(db: Session, conversation: Conversation, chat: ChatModel) -> bool:
    """Summarise the older part of a long chat. Returns True if it did."""
    pending = unsummarized(conversation)
    if len(pending) <= SUMMARIZE_AFTER:
        return False

    old = pending[:-KEEP_RECENT]
    transcript = "\n".join(f"{'User' if m.role == 'user' else 'Buddy'}: {m.content}" for m in old)
    if conversation.summary:
        transcript = f"Previous summary:\n{conversation.summary}\n\nConversation:\n{transcript}"

    try:
        summary = await chat.complete(SUMMARY_PROMPT, [{"role": "user", "content": transcript}])
    except ProviderError:
        return False  # not worth bothering the user about, it'll try again next turn

    conversation.summary = summary.strip()
    conversation.summarized_upto = old[-1].id
    db.commit()
    return True
