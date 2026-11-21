from app.database import SessionLocal
from app.memory import build_context
from app.models import Conversation, Message


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
