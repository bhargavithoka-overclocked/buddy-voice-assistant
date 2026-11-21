"""
Fully local speech: Whisper (through faster-whisper) turns your voice into
text and Piper talks back. Nothing leaves the computer. This is what the
desktop app uses, since the browser's speech recognition isn't available there.
"""

import asyncio
import io
import wave
from pathlib import Path

import numpy as np

from ..config import settings
from .base import ProviderError
from .piper_voice import FreeSpeech

WHISPER_RATE = 16000


def wav_to_samples(audio: bytes) -> np.ndarray:
    """WAV bytes -> mono float32 samples at 16 kHz, which is what Whisper wants."""
    with wave.open(io.BytesIO(audio)) as wav:
        rate = wav.getframerate()
        channels = wav.getnchannels()
        frames = wav.readframes(wav.getnframes())

    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if rate != WHISPER_RATE and len(samples):
        # simple linear resampling, plenty for speech
        new_length = int(len(samples) * WHISPER_RATE / rate)
        samples = np.interp(np.linspace(0, len(samples) - 1, new_length), np.arange(len(samples)), samples)
    return samples.astype(np.float32)


class LocalSpeech(FreeSpeech):
    def __init__(self):
        super().__init__()
        self._model = None
        self._model_loaded = False

    def model_dir(self) -> Path:
        return Path(settings.whisper_dir) / settings.whisper_model

    def load_model(self):
        if not self._model_loaded:
            self._model_loaded = True
            if (self.model_dir() / "model.bin").exists():
                from faster_whisper import WhisperModel  # slow import, only when needed

                self._model = WhisperModel(str(self.model_dir()), device="cpu", compute_type="int8")
        return self._model

    async def transcribe(self, audio: bytes, mime: str = "audio/wav") -> str:
        model = await asyncio.to_thread(self.load_model)
        if model is None:
            raise ProviderError("Buddy's speech recognition isn't downloaded yet. Run the setup again from Settings.")
        try:
            samples = wav_to_samples(audio)
        except (wave.Error, EOFError) as e:
            raise ProviderError("I couldn't make sense of that audio. Try again?") from e
        return await asyncio.to_thread(self._run, model, samples)

    @staticmethod
    def _run(model, samples: np.ndarray) -> str:
        # beam_size=1 is quicker and good enough for short spoken sentences
        segments, _ = model.transcribe(samples, language="en", beam_size=1)
        return " ".join(segment.text.strip() for segment in segments).strip()
