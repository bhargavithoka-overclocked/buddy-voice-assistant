"""
The free voice setup: Piper (an open-source text-to-speech that runs on
this computer) does Buddy's voice, and the browser does the listening.
"""

import asyncio
import io
import os
import threading
import wave
from pathlib import Path

from ..config import settings
from .base import ProviderError

# espeak (which Piper uses to turn words into sounds) only accepts a data folder
# path shorter than this. A longer one makes it fall back to a path that doesn't
# exist on this Mac and then quit the whole backend.
ESPEAK_PATH_LIMIT = 150


def espeak_data_dir(full_path: str) -> str | None:
    """A path to espeak's data short enough for it, or None if there isn't one."""
    if len(full_path) < ESPEAK_PATH_LIMIT:
        return full_path
    relative = os.path.relpath(full_path)
    if len(relative) < ESPEAK_PATH_LIMIT:
        return relative
    return None


class FreeSpeech:
    def __init__(self):
        self._voice = None
        self._loaded = False
        # sentences are spoken in parallel, and only one of them should load the voice
        self._lock = threading.Lock()

    def voice_path(self) -> Path:
        return Path(settings.voices_dir) / f"{settings.piper_voice}.onnx"

    def load_voice(self):
        with self._lock:
            if self._loaded:
                return self._voice
            self._loaded = True
            if self.voice_path().exists():
                from piper import PiperVoice  # imported here because it's slow to load
                from piper.phonemize_espeak import ESPEAK_DATA_DIR

                data_dir = espeak_data_dir(str(ESPEAK_DATA_DIR))
                if data_dir is not None:  # otherwise the browser's voice takes over
                    self._voice = PiperVoice.load(self.voice_path(), espeak_data_dir=data_dir)
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
