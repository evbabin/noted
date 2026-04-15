import os
from typing import Any, AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.dependencies import get_db as deps_get_db
from app.main import create_app
from app.models import (  # noqa: F401 — register all models with Base.metadata
    note,
    note_version,
    notebook,
    quiz,
    quiz_attempt,
    quiz_question,
    user,
    workspace,
    workspace_member,
)
from app.models.base import Base
from app.services import auth_service

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://noted:noted@localhost:5432/noted_test",
)


class FakeAsyncRedis:
    """In-memory async Redis stand-in for tests. Supports the methods auth_service uses."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def setex(self, key: str, _ttl: int, value: str) -> None:
        self._store[key] = value

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def delete(self, key: str) -> int:
        return 1 if self._store.pop(key, None) is not None else 0

    async def ping(self) -> bool:
        return True


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> FakeAsyncRedis:
    redis = FakeAsyncRedis()
    monkeypatch.setattr(auth_service, "get_redis", lambda: redis)
    return redis


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(
    db_session: AsyncSession, fake_redis: FakeAsyncRedis
) -> AsyncIterator[AsyncClient]:
    app = create_app()

    async def _get_db_override() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[deps_get_db] = _get_db_override

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
def register_payload() -> dict[str, Any]:
    return {
        "email": "alice@example.com",
        "password": "correct-horse-battery",
        "display_name": "Alice",
    }
