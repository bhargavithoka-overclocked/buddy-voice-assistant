from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Claude. The key is optional here: the Anthropic SDK also picks up
    # ANTHROPIC_API_KEY from the environment or an `ant auth login` profile.
    anthropic_api_key: str | None = None
    claude_fast_model: str = "claude-haiku-5-5"
    claude_smart_model: str = "claude-opus-5-5"

    # ChatGPT, plus OpenAI's speech-to-text and text-to-speech
    openai_api_key: str | None = None
    openai_fast_model: str = "your-gpt-5-luna-model-id"
    openai_smart_model: str = "your-sol-model-id"
    transcribe_model: str = "gpt-4o-mini-transcribe"
    tts_model: str = "gpt-4o-mini-tts"
    tts_voice: str = "ash"

    database_url: str = "sqlite:///./buddy.db"
    allowed_origins: str = "http://localhost:5173"

    # fake AI + voice, so the app runs without any keys
    demo_mode: bool = False


settings = Settings()
