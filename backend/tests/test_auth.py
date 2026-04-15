from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
import pytest
from httpx import AsyncClient

from app.config import get_settings
from app.services import auth_service

settings = get_settings()
pytestmark = pytest.mark.asyncio


async def _register(client: AsyncClient, payload: dict[str, Any]):
    return await client.post("/api/v1/auth/register", json=payload)


async def test_register_success(client: AsyncClient, register_payload: dict[str, Any]):
    resp = await _register(client, register_payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["email"] == register_payload["email"]
    assert body["user"]["display_name"] == register_payload["display_name"]


async def test_register_duplicate_email_409(
    client: AsyncClient, register_payload: dict[str, Any]
):
    first = await _register(client, register_payload)
    assert first.status_code == 201
    second = await _register(client, register_payload)
    assert second.status_code == 409


async def test_login_success(client: AsyncClient, register_payload: dict[str, Any]):
    await _register(client, register_payload)
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": register_payload["email"],
            "password": register_payload["password"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["email"] == register_payload["email"]


async def test_login_wrong_password_401(
    client: AsyncClient, register_payload: dict[str, Any]
):
    await _register(client, register_payload)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": register_payload["email"], "password": "not-the-password"},
    )
    assert resp.status_code == 401


async def test_refresh_token_rotation(
    client: AsyncClient, register_payload: dict[str, Any]
):
    reg = await _register(client, register_payload)
    original_refresh = reg.json()["refresh_token"]

    rotated = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": original_refresh}
    )
    assert rotated.status_code == 200
    new_pair = rotated.json()
    assert new_pair["refresh_token"] != original_refresh
    assert new_pair["access_token"]

    replay = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": original_refresh}
    )
    assert replay.status_code == 401


async def test_expired_access_token_401(client: AsyncClient):
    expired = jwt.encode(
        {
            "sub": "00000000-0000-0000-0000-000000000001",
            "email": "ghost@example.com",
            "type": "access",
            "iat": int((datetime.now(timezone.utc) - timedelta(hours=2)).timestamp()),
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"}
    )
    assert resp.status_code == 401


async def test_google_oauth_callback_creates_user(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")

    class _FakeResponse:
        def __init__(self, status_code: int, payload: dict[str, Any]):
            self.status_code = status_code
            self._payload = payload

        def json(self) -> dict[str, Any]:
            return self._payload

    class _FakeAsyncClient:
        def __init__(self, *_, **__):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

        async def post(self, url: str, **_):
            assert url == auth_service.GOOGLE_TOKEN_URL
            return _FakeResponse(200, {"access_token": "google-access"})

        async def get(self, url: str, **_):
            assert url == auth_service.GOOGLE_USERINFO_URL
            return _FakeResponse(
                200,
                {
                    "sub": "google-uid-123",
                    "email": "newgoogle@example.com",
                    "name": "Google User",
                    "picture": "https://example.com/avatar.png",
                    "email_verified": True,
                },
            )

    monkeypatch.setattr(auth_service.httpx, "AsyncClient", _FakeAsyncClient)

    resp = await client.get(
        "/api/v1/auth/google/callback", params={"code": "fake-code"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["email"] == "newgoogle@example.com"
    assert body["user"]["display_name"] == "Google User"
    assert body["access_token"]
    assert body["refresh_token"]
