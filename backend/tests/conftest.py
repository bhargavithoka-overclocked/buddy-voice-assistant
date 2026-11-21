import os

# throwaway database and fake AI for the tests (must be set before importing the app)
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["DEMO_MODE"] = "true"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c
