import os
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The desktop app keeps everything (chats, models, voice, keys) in one folder the
# user picks, and passes it in as BUDDY_DATA_DIR. Keys then live in <folder>/buddy.env.
DATA_DIR = os.environ.get("BUDDY_DATA_DIR")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Ollama, free models that run on this computer (the default)
    ollama_url: str = "http://localhost:11434"
    ollama_fast_model: str = "llama3.2:3b"
    ollama_smart_model: str = "llama3.1:8b"

    # Gemini's free tier (key from aistudio.google.com/apikey)
    gemini_api_key: str | None = None
    gemini_fast_model: str = "gemini-3.5-flash-lite"
    gemini_smart_model: str = "gemini-3.8-flash"

    # Claude. The key is optional here: the Anthropic SDK also picks up
    # ANTHROPIC_API_KEY from the environment or an `ant auth login` profile.
    anthropic_api_key: str | None = None
    claude_fast_model: str = "claude-haiku-5-5"
    claude_smart_model: str = "claude-opus-5-5"

    # ChatGPT, plus OpenAI's speech-to-text and text-to-speech
    openai_api_key: str | None = None
    openai_fast_model: str = "your-gpt-5-luna-model-id"
    openai_smart_model: str = "your-sol-model-id"
    # "free": Piper voice + the browser listens (web version)
    # "local": Piper voice + Whisper listens, all on this computer (desktop app)
    # "openai": OpenAI does both (needs a key)
    voice_engine: str = "free"
    whisper_model: str = "base.en"
    whisper_dir: str = "whisper"
    piper_voice: str = "en_US-ryan-medium"
    voices_dir: str = "voices"
    transcribe_model: str = "gpt-4o-mini-transcribe"
    tts_model: str = "gpt-4o-mini-tts"
    tts_voice: str = "ash"

    database_url: str = "sqlite:///./buddy.db"
    allowed_origins: str = "http://localhost:5173"

    # fake AI + voice, so the app runs without any keys
    demo_mode: bool = False

    data_dir: str | None = None
    # built frontend to serve at /, so the desktop app only needs one server
    frontend_dir: str | None = None

    @model_validator(mode="after")
    def keep_everything_in_the_data_folder(self):
        if self.data_dir:
            folder = Path(self.data_dir)
            self.database_url = f"sqlite:///{folder / 'buddy.db'}"
            self.voices_dir = str(folder / "voices")
            self.whisper_dir = str(folder / "whisper")
        return self


settings = Settings(
    data_dir=DATA_DIR,
    _env_file=[".env", Path(DATA_DIR) / "buddy.env"] if DATA_DIR else ".env",
)
