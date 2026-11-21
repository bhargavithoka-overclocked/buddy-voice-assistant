from fastapi import FastAPI

app = FastAPI(title="Buddy")


@app.get("/health")
def health():
    return {"status": "ok"}
