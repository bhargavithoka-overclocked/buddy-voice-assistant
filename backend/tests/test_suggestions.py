import asyncio

from app.providers.fake import FakeChat
from app.suggestions import parse_suggestions, suggest_follow_ups


def test_parse_cleans_up_numbering():
    text = '1. Tell me more\n2) "What about winter?"\n- Any tips?\n\n* Another one'
    assert parse_suggestions(text) == ["Tell me more", "What about winter?", "Any tips?"]


def test_parse_skips_duplicates_and_long_lines():
    text = "Tell me more\ntell me more\n" + "x" * 100 + "\nWhy?"
    assert parse_suggestions(text) == ["Tell me more", "Why?"]


def test_suggest_follow_ups():
    history = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello!"}]
    suggestions = asyncio.run(suggest_follow_ups(FakeChat(delay=0), history))
    assert len(suggestions) == 3


def test_suggestions_sent_after_reply(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "hello"})
        ws.receive_json()
        ws.send_json({"type": "text", "text": "hello"})
        while (message := ws.receive_json())["type"] != "suggestions":
            pass
    assert message["items"] == ["What else can you do?", "Tell me a fun fact", "How was your day?"]


def test_drops_speaker_labels():
    text = "User: What is Paris known for?\nYou: Tell me more\nBuddy: Are gorillas smart?"
    assert parse_suggestions(text) == ["What is Paris known for?", "Tell me more", "Are gorillas smart?"]
