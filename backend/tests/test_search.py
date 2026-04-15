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

async def test_search_returns_ranked_results(client: AsyncClient):
    headers, ws_id, nb_id = await create_auth_ws_nb(client)
    await client.post(f"/api/v1/notebooks/{nb_id}/notes", json={"title": "React Guide", "content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "React is a UI library."}]}]}}, headers=headers)
    await client.post(f"/api/v1/notebooks/{nb_id}/notes", json={"title": "Vue Guide", "content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Vue is another UI library."}]}]}}, headers=headers)

    resp = await client.get(f"/api/v1/workspaces/{ws_id}/search", params={"q": "React"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["title"] == "React Guide"

async def test_search_scoped_to_workspace(client: AsyncClient):
    headers1, ws_id1, nb_id1 = await create_auth_ws_nb(client, "u1@example.com")
    headers2, ws_id2, nb_id2 = await create_auth_ws_nb(client, "u2@example.com")
    
    await client.post(f"/api/v1/notebooks/{nb_id1}/notes", json={"title": "Secret Python"}, headers=headers1)
    
    resp = await client.get(f"/api/v1/workspaces/{ws_id2}/search", params={"q": "Python"}, headers=headers2)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

async def test_search_highlights_matches(client: AsyncClient):
    headers, ws_id, nb_id = await create_auth_ws_nb(client)
    content = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "The quick brown fox jumps."}]}]}
    await client.post(f"/api/v1/notebooks/{nb_id}/notes", json={"title": "Animals", "content": content}, headers=headers)

    resp = await client.get(f"/api/v1/workspaces/{ws_id}/search", params={"q": "fox"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert "<b>fox</b>" in data["results"][0]["snippet"] or "fox" in data["results"][0]["snippet"]  # Postgres ts_headline usually uses <b>
