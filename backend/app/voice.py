"""
The live voice conversation. The browser and the server talk over one
WebSocket using small JSON messages:

  browser -> server   hello, settings, audio, text
  server -> browser   ready, transcript, thinking, speech, done, error
"""

import asyncio
import base64

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .database import SessionLocal
from .memory import build_context
from .models import Conversation, Message
from .providers import MODES, PROVIDERS, ProviderError, get_chat, get_speech
from .sentences import split_sentences

router = APIRouter()


def make_title(text: str, limit: int = 40) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "..."


class VoiceSession:
    def __init__(self, websocket: WebSocket):
        self.ws = websocket
        self.conversation_id: int | None = None
        self.provider = "claude"
        self.mode = "fast"
        self.turn: asyncio.Task | None = None

    async def send(self, type: str, **data):
        await self.ws.send_json({"type": type, **data})

    async def handle(self, message: dict):
        kind = message.get("type")
        if kind == "hello":
            await self.hello(message)
        elif kind == "settings":
            self.update_settings(message)
        elif self.conversation_id is None:
            await self.send("error", message="Say hello first.")
        elif kind == "text":
            self.start_turn(text=message.get("text", ""))
        elif kind == "audio":
            audio = base64.b64decode(message.get("data", ""))
            self.start_turn(audio=audio, mime=message.get("mime", "audio/wav"))
        else:
            await self.send("error", message=f"Unknown message type: {kind}")

    async def hello(self, message: dict):
        self.update_settings(message)
        with SessionLocal() as db:
            conversation = None
            if message.get("conversation_id"):
                conversation = db.get(Conversation, message["conversation_id"])
            if conversation is None:
                conversation = Conversation()
                db.add(conversation)
                db.commit()
            self.conversation_id = conversation.id
        await self.send("ready", conversation_id=self.conversation_id)

    def update_settings(self, message: dict):
        if message.get("provider") in PROVIDERS:
            self.provider = message["provider"]
        if message.get("mode") in MODES:
            self.mode = message["mode"]

    def start_turn(self, text: str = "", audio: bytes = b"", mime: str = "audio/wav"):
        self.turn = asyncio.create_task(self.run_turn(text, audio, mime))

    async def run_turn(self, text: str, audio: bytes, mime: str):
        try:
            if audio:
                text = await get_speech().transcribe(audio, mime)
                await self.send("transcript", text=text)
            text = text.strip()
            if not text:
                await self.send("nothing_heard")
                return

            with SessionLocal() as db:
                conversation = db.get(Conversation, self.conversation_id)
                db.add(Message(conversation_id=conversation.id, role="user", content=text))
                if conversation.title == "New chat":
                    conversation.title = make_title(text)
                    await self.send("title", title=conversation.title)
                db.commit()
                db.refresh(conversation)
                system, history = build_context(db, conversation)

            await self.send("thinking")
            spoken = []
            await self.speak_reply(get_chat(self.provider, self.mode).stream(system, history), spoken)
            self.save_reply(" ".join(spoken))
            await self.send("done")
        except ProviderError as e:
            await self.send("error", message=str(e))

    async def speak_reply(self, chunks, spoken: list[str]):
        """
        Turns each sentence into speech as soon as it's written, while the
        model keeps writing the rest. Sentences are still sent in order.
        """
        speech = get_speech()
        queue: asyncio.Queue = asyncio.Queue()

        async def write_sentences():
            try:
                async for sentence in split_sentences(chunks):
                    queue.put_nowait((sentence, asyncio.create_task(speech.speak(sentence))))
            finally:
                queue.put_nowait(None)

        writer = asyncio.create_task(write_sentences())
        try:
            index = 0
            while (item := await queue.get()) is not None:
                sentence, voice = item
                audio, audio_format = await voice
                await self.send(
                    "speech",
                    index=index,
                    text=sentence,
                    audio=base64.b64encode(audio).decode(),
                    format=audio_format,
                )
                spoken.append(sentence)
                index += 1
            await writer  # raises if the model failed halfway
        finally:
            writer.cancel()
            while not queue.empty():
                if item := queue.get_nowait():
                    item[1].cancel()

    def save_reply(self, text: str):
        if not text:
            return
        with SessionLocal() as db:
            db.add(Message(conversation_id=self.conversation_id, role="assistant", content=text))
            db.commit()

    async def close(self):
        if self.turn:
            self.turn.cancel()


@router.websocket("/ws")
async def voice_socket(websocket: WebSocket):
    await websocket.accept()
    session = VoiceSession(websocket)
    try:
        while True:
            await session.handle(await websocket.receive_json())
    except WebSocketDisconnect:
        pass
    finally:
        await session.close()
