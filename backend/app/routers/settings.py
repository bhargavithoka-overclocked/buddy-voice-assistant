import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..providers import PROVIDERS, ProviderError, get_chat

router = APIRouter(prefix="/api/settings", tags=["settings"])

# where `ant auth login` keeps its profiles. We only check that it exists, never read it.
ANT_PROFILE_DIR = Path.home() / ".config" / "anthropic"


def claude_status() -> dict:
    if settings.anthropic_api_key:
        return {"connected": True, "source": "ANTHROPIC_API_KEY in backend/.env"}
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return {"connected": True, "source": "environment variable"}
    if ANT_PROFILE_DIR.is_dir():
        return {"connected": True, "source": "ant CLI login (ant auth login)"}
    return {"connected": False, "source": None}


def openai_status() -> dict:
    if settings.openai_api_key:
        return {"connected": True, "source": "OPENAI_API_KEY in backend/.env"}
    if os.environ.get("OPENAI_API_KEY"):
        return {"connected": True, "source": "environment variable"}
    return {"connected": False, "source": None}


@router.get("")
def get_settings():
    return {
        "demo_mode": settings.demo_mode,
        "claude": {**claude_status(), "models": {"fast": settings.claude_fast_model, "smart": settings.claude_smart_model}},
        "openai": {**openai_status(), "models": {"fast": settings.openai_fast_model, "smart": settings.openai_smart_model}},
        # speech always goes through OpenAI
        "voice": openai_status(),
    }


@router.post("/test/{provider}")
async def test_connection(provider: str):
    """Sends a tiny request to check the key actually works."""
    if provider not in PROVIDERS:
        raise HTTPException(404, "Unknown provider")
    try:
        await get_chat(provider, "fast").complete("Reply with just: OK", [{"role": "user", "content": "ping"}])
    except ProviderError as e:
        return {"ok": False, "message": str(e)}
    return {"ok": True, "message": "Connected!"}
