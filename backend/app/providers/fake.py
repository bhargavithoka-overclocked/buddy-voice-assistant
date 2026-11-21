"""
Stand-ins for the real AI and voice services. Used by the tests, and by
DEMO_MODE so you can click around the app without any API keys.
"""

import asyncio
import io
import math
import random
import struct
import wave

REPLIES = [
    "Ha, I love that. {echo} Tell me more about it!",
    "Ooh, good question. {echo} I'm just a demo gorilla right now, but I'm all ears.",
    "Interesting! {echo} Add an API key in Settings and I'll give you a real answer.",
]


class FakeChat:
    def __init__(self, delay: float = 0.03):
        self.delay = delay

    def _reply(self, system: str, messages: list[dict]) -> str:
        if "suggest" in system.lower():
            return "What else can you do?\nTell me a fun fact\nHow was your day?"
        if "summar" in system.lower():
            return "We chatted about a few things."
        last = messages[-1]["content"] if messages else ""
        echo = f'You said "{last[:60]}".' if last else ""
        return random.Random(len(messages)).choice(REPLIES).format(echo=echo)

    async def stream(self, system: str, messages: list[dict]):
        for word in self._reply(system, messages).split(" "):
            await asyncio.sleep(self.delay)
            yield word + " "

    async def complete(self, system: str, messages: list[dict]) -> str:
        return self._reply(system, messages)


class FakeSpeech:
    def __init__(self, transcript: str = "Hey Buddy, how are you doing today?"):
        self.transcript = transcript

    async def transcribe(self, audio: bytes, mime: str = "audio/wav") -> str:
        return self.transcript if audio else ""

    async def speak(self, text: str) -> tuple[bytes, str]:
        return beep_speech(text), "wav"


def beep_speech(text: str, rate: int = 16000) -> bytes:
    """A wobbly hum about as long as the sentence, so Buddy's mouth has something to move to."""
    seconds = min(max(len(text.split()) * 0.25, 0.5), 8)
    frames = bytearray()
    for i in range(int(seconds * rate)):
        t = i / rate
        syllables = abs(math.sin(2 * math.pi * 3 * t))  # ~6 "syllables" a second
        sample = 0.2 * syllables * (math.sin(2 * math.pi * 180 * t) + 0.5 * math.sin(2 * math.pi * 270 * t))
        frames += struct.pack("<h", int(sample * 32767 / 1.5))

    out = io.BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(bytes(frames))
    return out.getvalue()
