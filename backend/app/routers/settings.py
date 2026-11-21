import asyncio
import json
import os
import urllib.request
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..providers import PROVIDERS, ProviderError, get_chat
from ..providers.gemini import gemini_key
from ..providers.piper_voice import FreeSpeech

router = APIRouter(prefix="/api/settings", tags=["settings"])

# where `ant auth login` keeps its profiles. We only check that it exists, never read it.
ANT_PROFILE_DIR = Path.home() / ".config" / "anthropic"


def models(fast: str, smart: str) -> dict:
    return {"fast": fast, "smart": smart}


def ollama_models() -> list[str] | None:
    """Names of the models Ollama has downloaded, or None if it isn't running."""
    try:
        with urllib.request.urlopen(f"{settings.ollama_url.rstrip('/')}/api/tags", timeout=1.5) as response:
            return [m["name"] for m in json.load(response).get("models", [])]
    except (OSError, ValueError):
        return None


async def ollama_status() -> dict:
    wanted = [settings.ollama_fast_model, settings.ollama_smart_model]
    installed = await asyncio.to_thread(ollama_models)
    if installed is None:
        return {"connected": False, "source": None, "missing": wanted}
    # "llama3.2" and "llama3.2:latest" are the same model
    have = set(installed) | {name.removesuffix(":latest") for name in installed}
    missing = [m for m in dict.fromkeys(wanted) if m not in have]
    return {"connected": True, "source": "Ollama is running on this computer", "missing": missing}


def gemini_status() -> dict:
    if settings.gemini_api_key:
        return {"connected": True, "source": "GEMINI_API_KEY in backend/.env"}
    if gemini_key():
        return {"connected": True, "source": "environment variable"}
    return {"connected": False, "source": None}


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


def voice_status() -> dict:
    if settings.voice_engine == "openai":
        return {"engine": "openai", "voice": "OpenAI", "listening": "OpenAI", **openai_status()}

    has_piper = FreeSpeech().voice_path().exists()
    if settings.demo_mode:
        listening = "demo mode"
    elif settings.voice_engine == "local":
        listening = "Whisper on this computer"
    else:
        listening = "your browser"
    return {
        "engine": settings.voice_engine,
        "voice": f"Piper ({settings.piper_voice})" if has_piper else "your browser's voice",
        "piper_installed": has_piper,
        "piper_voice": settings.piper_voice,
        "listening": listening,
        "connected": True,
        "source": None,
    }


@router.get("")
async def get_settings():
    return {
        "demo_mode": settings.demo_mode,
        "ollama": {**await ollama_status(), "models": models(settings.ollama_fast_model, settings.ollama_smart_model)},
        "gemini": {**gemini_status(), "models": models(settings.gemini_fast_model, settings.gemini_smart_model)},
        "claude": {**claude_status(), "models": models(settings.claude_fast_model, settings.claude_smart_model)},
        "openai": {**openai_status(), "models": models(settings.openai_fast_model, settings.openai_smart_model)},
        "voice": voice_status(),
    }


@router.post("/test/{provider}")
async def test_connection(provider: str):
    """Sends a tiny request to check the model actually answers."""
    if provider not in PROVIDERS:
        raise HTTPException(404, "Unknown provider")
    try:
        await get_chat(provider, "fast").complete("Reply with just: OK", [{"role": "user", "content": "ping"}])
    except ProviderError as e:
        return {"ok": False, "message": str(e)}
    return {"ok": True, "message": "Connected!"}
