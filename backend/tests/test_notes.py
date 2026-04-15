import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def create_auth_ws_nb(client: AsyncClient, email="test@example.com"):
    reg = await client.post("/api/v1/auth/register", json={"email": email, "password": "correct-horse-battery", "display_name": "Test"})
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    ws = await client.post("/api/v1/workspaces/", json={"name": "WS"}, headers=headers)
    ws_id = ws.json()["id"]
    nb = await client.post(f"/api/v1/workspaces/{ws_id}/notebooks", json={"title": "NB"}, headers=headers)
    return headers, ws_id, nb.json()["id"]

async def test_create_note_with_json_content(client: AsyncClient):
    headers, ws_id, nb_id = await create_auth_ws_nb(client)
    content = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello World"}]}]}
    resp = await client.post(f"/api/v1/notebooks/{nb_id}/notes", json={"title": "Note 1", "content": content}, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Note 1"
    assert data["content"] == content
    assert data["version"] == 1

async def test_update_creates_version(client: AsyncClient):
    headers, ws_id, nb_id = await create_auth_ws_nb(client)
    note = await client.post(f"/api/v1/notebooks/{nb_id}/notes", json={"title": "Note 1"}, headers=headers)
    note_id = note.json()["id"]

    resp = await client.patch(f"/api/v1/notes/{note_id}", json={"title": "Updated Note 1"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["version"] == 2

    # Check versions
    v_resp = await client.get(f"/api/v1/notes/{note_id}/versions", headers=headers)
    versions = v_resp.json()
    assert len(versions) == 2
    assert versions[0]["version_number"] == 2
    assert versions[1]["version_number"] == 1

async def test_plain_text_mirror_updated(client: AsyncClient):
    headers, ws_id, nb_id = await create_auth_ws_nb(client)
    content = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello Search"}]}]}
    note = await client.post(f"/api/v1/notebooks/{nb_id}/notes", json={"title": "Note 1", "content": content}, headers=headers)
    note_id = note.json()["id"]

    resp = await client.get(f"/api/v1/notes/{note_id}", headers=headers)
    assert resp.json()["content_text"] == "Hello Search"

async def test_version_history_ordered(client: AsyncClient):
    headers, ws_id, nb_id = await create_auth_ws_nb(client)
    note = await client.post(f"/api/v1/notebooks/{nb_id}/notes", json={"title": "v1"}, headers=headers)
    note_id = note.json()["id"]
    await client.patch(f"/api/v1/notes/{note_id}", json={"title": "v2"}, headers=headers)
    await client.patch(f"/api/v1/notes/{note_id}", json={"title": "v3"}, headers=headers)

    v_resp = await client.get(f"/api/v1/notes/{note_id}/versions", headers=headers)
    versions = v_resp.json()
    assert len(versions) == 3
    assert versions[0]["version_number"] == 3
    assert versions[1]["version_number"] == 2
    assert versions[2]["version_number"] == 1
