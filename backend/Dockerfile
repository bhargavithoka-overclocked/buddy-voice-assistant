FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

# keep chats in a volume so they survive restarts
ENV DATABASE_URL=sqlite:////data/buddy.db
VOLUME /data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
