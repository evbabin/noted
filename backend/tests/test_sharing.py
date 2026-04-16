import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _register_user(
    client: AsyncClient,
    *,
    email: str,
    display_name: str,
) -> tuple[dict[str, str], str]:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "correct-horse-battery",
            "display_name": display_name,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]["id"]


async def _create_workspace(
    client: AsyncClient,
    headers: dict[str, str],
    name: str = "Shared Workspace",
) -> str:
    response = await client.post(
        "/api/v1/workspaces/",
        json={"name": name},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def test_owner_invites_existing_user_and_member_gains_access(client: AsyncClient):
    owner_headers, _owner_id = await _register_user(
        client,
        email="sharing-owner@example.com",
        display_name="Owner",
    )
    _member_headers, _member_id = await _register_user(
        client,
        email="sharing-member@example.com",
        display_name="Member",
    )
    workspace_id = await _create_workspace(client, owner_headers)

    invite = await client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        json={"email": "sharing-member@example.com", "role": "viewer"},
        headers=owner_headers,
    )
    assert invite.status_code == 201, invite.text
    invite_body = invite.json()
    assert invite_body["role"] == "viewer"
    assert invite_body["user"]["email"] == "sharing-member@example.com"

    member_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "sharing-member@example.com",
            "password": "correct-horse-battery",
        },
    )
    assert member_login.status_code == 200, member_login.text
    member_headers = {
        "Authorization": f"Bearer {member_login.json()['access_token']}"
    }

    workspace = await client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=member_headers,
    )
    assert workspace.status_code == 200, workspace.text

    members = await client.get(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=member_headers,
    )
    assert members.status_code == 200, members.text
    assert len(members.json()) == 2


async def test_inviting_unknown_email_creates_pending_invitation_applied_on_register(
    client: AsyncClient,
):
    owner_headers, _owner_id = await _register_user(
        client,
        email="pending-owner@example.com",
        display_name="Owner",
    )
    workspace_id = await _create_workspace(client, owner_headers, name="Pending Invite")

    invite = await client.post(
        f"/api/v1/workspaces/{workspace_id}/invitations",
        json={"email": "pending-member@example.com", "role": "editor"},
        headers=owner_headers,
    )
    assert invite.status_code == 202, invite.text
    invite_body = invite.json()
    assert invite_body["status"] == "pending"
    assert invite_body["role"] == "editor"

    pending_headers, _pending_user_id = await _register_user(
        client,
        email="pending-member@example.com",
        display_name="Pending Member",
    )

    workspace = await client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=pending_headers,
    )
    assert workspace.status_code == 200, workspace.text

    members = await client.get(
        f"/api/v1/workspaces/{workspace_id}/members",
        headers=owner_headers,
    )
    assert members.status_code == 200, members.text
    member_roles = {
        member["user"]["email"]: member["role"]
        for member in members.json()
    }
    assert member_roles["pending-member@example.com"] == "editor"


async def test_non_owner_cannot_invite_members(client: AsyncClient):
    owner_headers, _owner_id = await _register_user(
        client,
        email="rbac-owner@example.com",
        display_name="Owner",
    )
    await _register_user(
        client,
        email="rbac-editor@example.com",
        display_name="Editor",
    )
    await _register_user(
        client,
        email="rbac-target@example.com",
        display_name="Target",
    )
    workspace_id = await _create_workspace(client, owner_headers, name="RBAC Workspace")

    invite_editor = await client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        json={"email": "rbac-editor@example.com", "role": "editor"},
        headers=owner_headers,
    )
    assert invite_editor.status_code == 201, invite_editor.text

    editor_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "rbac-editor@example.com",
            "password": "correct-horse-battery",
        },
    )
    assert editor_login.status_code == 200, editor_login.text
    editor_headers = {
        "Authorization": f"Bearer {editor_login.json()['access_token']}"
    }

    invite_target = await client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        json={"email": "rbac-target@example.com", "role": "viewer"},
        headers=editor_headers,
    )
    assert invite_target.status_code == 403


async def test_owner_can_update_member_role(client: AsyncClient):
    owner_headers, _owner_id = await _register_user(
        client,
        email="role-owner@example.com",
        display_name="Owner",
    )
    await _register_user(
        client,
        email="role-viewer@example.com",
        display_name="Viewer",
    )
    workspace_id = await _create_workspace(client, owner_headers, name="Role Updates")

    invite = await client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        json={"email": "role-viewer@example.com", "role": "viewer"},
        headers=owner_headers,
    )
    assert invite.status_code == 201, invite.text
    member_id = invite.json()["user_id"]

    update = await client.patch(
        f"/api/v1/workspaces/{workspace_id}/members/{member_id}",
        json={"role": "editor"},
        headers=owner_headers,
    )
    assert update.status_code == 200, update.text
    assert update.json()["role"] == "editor"


async def test_owner_can_remove_member_and_member_loses_access(client: AsyncClient):
    owner_headers, _owner_id = await _register_user(
        client,
        email="remove-owner@example.com",
        display_name="Owner",
    )
    await _register_user(
        client,
        email="remove-member@example.com",
        display_name="Member",
    )
    workspace_id = await _create_workspace(client, owner_headers, name="Removal Workspace")

    invite = await client.post(
        f"/api/v1/workspaces/{workspace_id}/members",
        json={"email": "remove-member@example.com", "role": "viewer"},
        headers=owner_headers,
    )
    assert invite.status_code == 201, invite.text
    member_id = invite.json()["user_id"]

    member_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "remove-member@example.com",
            "password": "correct-horse-battery",
        },
    )
    assert member_login.status_code == 200, member_login.text
    member_headers = {
        "Authorization": f"Bearer {member_login.json()['access_token']}"
    }

    remove = await client.delete(
        f"/api/v1/workspaces/{workspace_id}/members/{member_id}",
        headers=owner_headers,
    )
    assert remove.status_code == 204, remove.text

    workspace = await client.get(
        f"/api/v1/workspaces/{workspace_id}",
        headers=member_headers,
    )
    assert workspace.status_code == 404
