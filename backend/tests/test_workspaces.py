import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_create_workspace_auto_owner(client: AsyncClient, register_payload: dict):
    reg = await client.post("/api/v1/auth/register", json=register_payload)
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = await client.post("/api/v1/workspaces/", json={"name": "My Workspace", "description": "Test"}, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Workspace"
    
    # check if user is owner
    ws_resp = await client.get(f"/api/v1/workspaces/{data['id']}", headers=headers)
    assert ws_resp.status_code == 200
    ws_data = ws_resp.json()
    assert len(ws_data["members"]) == 1
    assert ws_data["members"][0]["role"] == "owner"

async def test_list_only_member_workspaces(client: AsyncClient):
    # Register user1, create workspace1
    reg1 = await client.post("/api/v1/auth/register", json={"email": "u1@example.com", "password": "correct-horse-battery", "display_name": "U1"})
    token1 = reg1.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}
    ws_resp1 = await client.post("/api/v1/workspaces/", json={"name": "WS1"}, headers=headers1)
    assert ws_resp1.status_code == 201
    ws1_id = ws_resp1.json()["id"]

    # Register user2, create workspace2
    reg2 = await client.post("/api/v1/auth/register", json={"email": "u2@example.com", "password": "correct-horse-battery", "display_name": "U2"})
    token2 = reg2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}
    ws_resp2 = await client.post("/api/v1/workspaces/", json={"name": "WS2"}, headers=headers2)
    assert ws_resp2.status_code == 201

    # list workspaces for user1
    list1 = await client.get("/api/v1/workspaces/", headers=headers1)
    assert list1.status_code == 200
    data1 = list1.json()
    assert len(data1) == 1
    assert data1[0]["id"] == ws1_id

async def test_delete_workspace_cascades(client: AsyncClient, register_payload: dict):
    reg = await client.post("/api/v1/auth/register", json=register_payload)
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = await client.post("/api/v1/workspaces/", json={"name": "My Workspace"}, headers=headers)
    assert resp.status_code == 201
    ws_id = resp.json()["id"]

    # Delete workspace
    del_resp = await client.delete(f"/api/v1/workspaces/{ws_id}", headers=headers)
    assert del_resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/api/v1/workspaces/{ws_id}", headers=headers)
    assert get_resp.status_code == 404
