import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_health_includes_generated_request_id(client: AsyncClient):
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]


async def test_request_id_header_is_echoed(client: AsyncClient):
    request_id = "request-id-from-client"

    response = await client.get("/health", headers={"X-Request-ID": request_id})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == request_id
