import asyncio

from app import memory
from app.database import SessionLocal
from app.memory import build_context
from app.models import Conversation, Message
from app.providers.fake import FakeChat


def conversation_with(*turns):
    with SessionLocal() as db:
        conversation = Conversation()
        db.add(conversation)
        db.flush()
        for role, content, *flags in turns:
            db.add(Message(conversation_id=conversation.id, role=role, content=content, interrupted=bool(flags)))
        db.commit()
        db.refresh(conversation)
        return build_context(db, conversation)


def test_history_in_order(client):
    _, messages = conversation_with(("user", "hi"), ("assistant", "hey there"), ("user", "how are you"))
    assert messages == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hey there"},
        {"role": "user", "content": "how are you"},
    ]


def test_repeated_roles_are_merged(client):
    _, messages = conversation_with(("user", "hello?"), ("user", "are you there"))
    assert messages == [{"role": "user", "content": "hello?\nare you there"}]


def test_starts_with_the_user(client):
    _, messages = conversation_with(("assistant", "Hi, I'm Buddy!"), ("user", "hi Buddy"))
    assert messages[0]["role"] == "user"


def test_interrupted_replies_are_marked(client):
    _, messages = conversation_with(("user", "story?"), ("assistant", "Once upon a time", True))
    assert messages[1]["content"] == "Once upon a time [the user interrupted you here]"


def test_long_chats_get_summarised(client, monkeypatch):

    monkeypatch.setattr(memory, "SUMMARIZE_AFTER", 6)
    monkeypatch.setattr(memory, "KEEP_RECENT", 2)

    with SessionLocal() as db:
        conversation = Conversation()
        db.add(conversation)
        db.flush()
        for i in range(4):
            db.add(Message(conversation_id=conversation.id, role="user", content=f"question {i}"))
            db.add(Message(conversation_id=conversation.id, role="assistant", content=f"answer {i}"))
        db.commit()
        db.refresh(conversation)

        assert asyncio.run(memory.maybe_summarize(db, conversation, FakeChat(delay=0)))
        system, messages = build_context(db, conversation)

        assert "We chatted about a few things." in system
        assert messages == [
            {"role": "user", "content": "question 3"},
            {"role": "assistant", "content": "answer 3"},
        ]
        # nothing new since, so no second summary
        assert not asyncio.run(memory.maybe_summarize(db, conversation, FakeChat(delay=0)))
