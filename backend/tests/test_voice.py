import base64


def receive_until(ws, kind):
    """Collect messages until one of type `kind` arrives."""
    seen = []
    while True:
        message = ws.receive_json()
        seen.append(message)
        if message["type"] == kind:
            return seen


def start(ws, **extra):
    ws.send_json({"type": "hello", **extra})
    return ws.receive_json()


def test_hello_creates_a_conversation(client):
    with client.websocket_connect("/ws") as ws:
        ready = start(ws)
    assert ready["type"] == "ready"
    assert client.get(f"/api/conversations/{ready['conversation_id']}").status_code == 200


def test_hello_continues_an_existing_conversation(client):
    existing = client.post("/api/conversations").json()
    with client.websocket_connect("/ws") as ws:
        assert start(ws, conversation_id=existing["id"])["conversation_id"] == existing["id"]


def test_typed_message_gets_a_spoken_reply(client):
    with client.websocket_connect("/ws") as ws:
        conversation_id = start(ws)["conversation_id"]
        ws.send_json({"type": "text", "text": "What's your favourite food?"})
        messages = receive_until(ws, "done")

    kinds = [m["type"] for m in messages]
    assert kinds[:2] == ["title", "thinking"]
    speech = [m for m in messages if m["type"] == "speech"]
    assert speech and speech[0]["index"] == 0
    assert speech[0]["format"] == "wav"
    assert base64.b64decode(speech[0]["audio"])[:4] == b"RIFF"

    saved = client.get(f"/api/conversations/{conversation_id}").json()
    assert saved["title"] == "What's your favourite food?"
    assert [m["role"] for m in saved["messages"]] == ["user", "assistant"]
    assert saved["messages"][1]["content"] == " ".join(m["text"] for m in speech)


def test_audio_is_transcribed_first(client):
    with client.websocket_connect("/ws") as ws:
        start(ws)
        ws.send_json({"type": "audio", "mime": "audio/wav", "data": base64.b64encode(b"fake audio").decode()})
        messages = receive_until(ws, "done")
    assert messages[0] == {"type": "transcript", "text": "Hey Buddy, how are you doing today?"}


def test_silence(client):
    with client.websocket_connect("/ws") as ws:
        start(ws)
        ws.send_json({"type": "text", "text": "   "})
        assert ws.receive_json() == {"type": "nothing_heard"}


def test_must_say_hello_first(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"type": "text", "text": "hi"})
        assert ws.receive_json()["type"] == "error"


def test_interrupt_stops_the_reply(client, monkeypatch):
    from app import voice
    from app.providers.fake import FakeChat

    # a slow talker, so there's time to cut him off
    monkeypatch.setattr(voice, "get_chat", lambda provider, mode: FakeChat(delay=0.15))

    with client.websocket_connect("/ws") as ws:
        conversation_id = start(ws)["conversation_id"]
        ws.send_json({"type": "text", "text": "Tell me a long story please"})
        first_sentence = receive_until(ws, "speech")[-1]["text"]
        ws.send_json({"type": "interrupt"})
        assert receive_until(ws, "interrupted")[-1] == {"type": "interrupted"}

    saved = client.get(f"/api/conversations/{conversation_id}").json()["messages"]
    assert saved[-1]["role"] == "assistant"
    assert saved[-1]["interrupted"] is True
    assert saved[-1]["content"].startswith(first_sentence)


def test_interrupt_with_nothing_playing(client):
    with client.websocket_connect("/ws") as ws:
        start(ws)
        ws.send_json({"type": "interrupt"})
        ws.send_json({"type": "text", "text": " "})
        # no "interrupted" message, straight to the next reply
        assert ws.receive_json() == {"type": "nothing_heard"}


def test_done_reports_latency(client):
    with client.websocket_connect("/ws") as ws:
        start(ws)
        ws.send_json({"type": "audio", "data": base64.b64encode(b"x").decode()})
        latency = receive_until(ws, "done")[-1]["latency"]

    assert set(latency) == {"transcribed_ms", "first_token_ms", "first_audio_ms", "total_ms"}
    assert latency["transcribed_ms"] <= latency["first_token_ms"] <= latency["first_audio_ms"] <= latency["total_ms"]


def test_model_switch_is_used(client, monkeypatch):
    from app import voice
    from app.providers.fake import FakeChat

    used = []

    def fake_get_chat(provider, mode):
        used.append((provider, mode))
        return FakeChat(delay=0)

    monkeypatch.setattr(voice, "get_chat", fake_get_chat)

    with client.websocket_connect("/ws") as ws:
        start(ws, provider="claude", mode="fast")
        ws.send_json({"type": "settings", "provider": "openai", "mode": "smart"})
        ws.send_json({"type": "text", "text": "hi"})
        receive_until(ws, "suggestions")

    # the reply uses the chosen model, the extras always use the fast one
    assert used[0] == ("openai", "smart")
    assert all(choice == ("openai", "fast") for choice in used[1:])


def test_unknown_settings_are_ignored(client):
    with client.websocket_connect("/ws") as ws:
        start(ws, provider="gemini", mode="turbo")
        ws.send_json({"type": "text", "text": "hi"})
        assert receive_until(ws, "done")[-1]["type"] == "done"
