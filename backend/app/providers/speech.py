from ..config import settings
from .openai_chat import friendly_errors, get_client

EXTENSIONS = {"audio/wav": "wav", "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3"}


class OpenAISpeech:
    async def transcribe(self, audio: bytes, mime: str = "audio/wav") -> str:
        mime = mime.split(";")[0]
        filename = f"speech.{EXTENSIONS.get(mime, 'wav')}"
        async with friendly_errors("Speech recognition"):
            result = await get_client().audio.transcriptions.create(
                model=settings.transcribe_model,
                file=(filename, audio, mime),
            )
        return result.text.strip()

    async def speak(self, text: str) -> tuple[bytes, str]:
        """Returns (audio bytes, format)."""
        extra = {}
        if settings.tts_model.startswith("gpt-4o"):
            # only the gpt-4o voices understand style instructions
            extra["instructions"] = "Warm, relaxed and friendly, like chatting with a good friend."
        async with friendly_errors("Buddy's voice"):
            response = await get_client().audio.speech.create(
                model=settings.tts_model,
                voice=settings.tts_voice,
                input=text,
                response_format="mp3",
                **extra,
            )
        return response.content, "mp3"
