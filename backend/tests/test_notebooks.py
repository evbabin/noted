import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def create_auth_and_workspace(client: AsyncClient, email="test@example.com"):
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "correct-horse-battery",
            "display_name": "Test",
        },
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    ws_resp = await client.post(
        "/api/v1/workspaces/", json={"name": "WS"}, headers=headers
    )
    ws_id = ws_resp.json()["id"]
    return headers, ws_id


async def test_create_notebook(client: AsyncClient):
    headers, ws_id = await create_auth_and_workspace(client)
    resp = await client.post(
        f"/api/v1/workspaces/{ws_id}/notebooks",
        json={"title": "Notebook 1"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "Notebook 1"


async def test_reorder_notebooks(client: AsyncClient):
    headers, ws_id = await create_auth_and_workspace(client)
    nb1 = await client.post(
        f"/api/v1/workspaces/{ws_id}/notebooks", json={"title": "NB1"}, headers=headers
    )
    nb2 = await client.post(
        f"/api/v1/workspaces/{ws_id}/notebooks", json={"title": "NB2"}, headers=headers
    )
    nb1_id = nb1.json()["id"]
    nb2_id = nb2.json()["id"]

    resp = await client.post(
        f"/api/v1/workspaces/{ws_id}/notebooks/reorder",
        json={"ordered_ids": [nb2_id, nb1_id]},
        headers=headers,
    )
    assert resp.status_code == 200

    list_resp = await client.get(
        f"/api/v1/workspaces/{ws_id}/notebooks", headers=headers
    )
    nbs = list_resp.json()
    assert nbs[0]["id"] == nb2_id
    assert nbs[1]["id"] == nb1_id


async def test_cross_workspace_access_denied(client: AsyncClient):
    headers1, ws_id1 = await create_auth_and_workspace(client, "u1@example.com")
    headers2, ws_id2 = await create_auth_and_workspace(client, "u2@example.com")

    # u2 tries to list notebooks in ws1
    list_resp = await client.get(
        f"/api/v1/workspaces/{ws_id1}/notebooks", headers=headers2
    )
    assert list_resp.status_code == 404  # Non member gets 404
