"""
The free voice setup: Piper (an open-source text-to-speech that runs on
this computer) does Buddy's voice, and the browser does the listening.
"""

import asyncio
import io
import wave
from pathlib import Path

from ..config import settings
from .base import ProviderError


class FreeSpeech:
    def __init__(self):
        self._voice = None
        self._loaded = False

    def voice_path(self) -> Path:
        return Path(settings.voices_dir) / f"{settings.piper_voice}.onnx"

    def load_voice(self):
        if not self._loaded:
            self._loaded = True
            if self.voice_path().exists():
                from piper import PiperVoice  # imported here because it's slow to load

                self._voice = PiperVoice.load(self.voice_path())
        return self._voice

    async def transcribe(self, audio: bytes, mime: str = "audio/wav") -> str:
        raise ProviderError(
            "With the free setup your browser does the listening. Use Chrome, Edge or Safari, or type to me."
        )

    async def speak(self, text: str) -> tuple[bytes, str]:
        voice = await asyncio.to_thread(self.load_voice)
        if voice is None:
            # no Piper voice downloaded, so the browser's own voice reads it out instead
            return b"", "browser"
        return await asyncio.to_thread(self._synthesize, voice, text), "wav"

    @staticmethod
    def _synthesize(voice, text: str) -> bytes:
        out = io.BytesIO()
        with wave.open(out, "wb") as wav:
            voice.synthesize_wav(text, wav)
        return out.getvalue()
