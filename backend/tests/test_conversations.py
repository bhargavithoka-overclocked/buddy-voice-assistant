def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_create_and_list(client):
    first = client.post("/api/conversations").json()
    second = client.post("/api/conversations").json()

    assert first["title"] == "New chat"
    ids = [c["id"] for c in client.get("/api/conversations").json()]
    assert ids == [second["id"], first["id"]]  # newest first


def test_get_with_messages(client):
    conversation = client.post("/api/conversations").json()
    detail = client.get(f"/api/conversations/{conversation['id']}").json()
    assert detail["messages"] == []


def test_rename(client):
    conversation = client.post("/api/conversations").json()
    response = client.patch(f"/api/conversations/{conversation['id']}", json={"title": "  Trip ideas "})
    assert response.json()["title"] == "Trip ideas"
    assert client.patch(f"/api/conversations/{conversation['id']}", json={"title": " "}).status_code == 422


def test_delete(client):
    conversation = client.post("/api/conversations").json()
    assert client.delete(f"/api/conversations/{conversation['id']}").status_code == 204
    assert client.get(f"/api/conversations/{conversation['id']}").status_code == 404
