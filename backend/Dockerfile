FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

# Buddy's free voice (about 60 MB)
ARG PIPER_VOICE=en_US-ryan-medium
RUN python -m piper.download_voices ${PIPER_VOICE} --download-dir /app/voices
ENV VOICES_DIR=/app/voices

# keep chats in a volume so they survive restarts
ENV DATABASE_URL=sqlite:////data/buddy.db
VOLUME /data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
