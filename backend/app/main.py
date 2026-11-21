from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401  (registers the tables)
from .config import settings
from .database import Base, engine
from .routers import conversations
from .routers import settings as settings_router
from .voice import router as voice_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Buddy", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(conversations.router)
app.include_router(settings_router.router)
app.include_router(voice_router)


@app.get("/health")
def health():
    return {"status": "ok"}


def serve_frontend(app: FastAPI, folder: str):
    # mounted last, so /api, /ws and /health still win
    app.mount("/", StaticFiles(directory=folder, html=True), name="frontend")


if settings.frontend_dir:
    serve_frontend(app, settings.frontend_dir)
