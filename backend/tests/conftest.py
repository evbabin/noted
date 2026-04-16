import asyncio
import importlib
import os
from collections import defaultdict
from typing import Any, AsyncIterator

import app.main as app_main
import app.middleware.rate_limit as rate_limit_module
import app.services.search_service as search_service
import app.services.sharing_service as sharing_service
import app.websocket.handlers as websocket_handlers
import pytest
import pytest_asyncio
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
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

websocket_manager_module = importlib.import_module("app.websocket.manager")

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://noted:noted@localhost:5432/noted_test",
)


class FakePubSub:
    def __init__(self, redis: "FakeAsyncRedis") -> None:
        self._redis = redis
        self._queue: asyncio.Queue[dict[str, str]] = asyncio.Queue()
        self._channels: set[str] = set()
        self._closed = False

    async def subscribe(self, *channels: str) -> None:
        for channel in channels:
            self._channels.add(channel)
            self._redis._subscribers[channel].add(self)

    async def unsubscribe(self, *channels: str) -> None:
        target_channels = channels or tuple(self._channels)
        for channel in target_channels:
            self._channels.discard(channel)
            subscribers = self._redis._subscribers.get(channel)
            if subscribers is not None:
                subscribers.discard(self)
                if not subscribers:
                    self._redis._subscribers.pop(channel, None)

    async def get_message(
        self,
        ignore_subscribe_messages: bool = True,
        timeout: float | None = 0.0,
    ) -> dict[str, str] | None:
        if self._closed:
            return None
        try:
            if timeout is None:
                return await self._queue.get()
            if timeout <= 0:
                return self._queue.get_nowait()
            return await asyncio.wait_for(self._queue.get(), timeout=timeout)
        except asyncio.QueueEmpty:
            return None
        except TimeoutError:
            return None

    async def put_message(self, channel: str, data: str) -> None:
        if self._closed:
            return
        await self._queue.put(
            {
                "type": "message",
                "channel": channel,
                "data": data,
            }
        )

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self.unsubscribe()

    async def close(self) -> None:
        await self.aclose()


class FakeAsyncRedis:
    """In-memory async Redis stand-in for tests."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._hash_store: dict[str, dict[str, str]] = {}
        self._ttl_store: dict[str, int] = {}
        self._subscribers: dict[str, set[FakePubSub]] = defaultdict(set)

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self._store[key] = value
        self._ttl_store[key] = ttl

    async def set(
        self,
        key: str,
        value: str,
        ex: int | None = None,
        nx: bool = False,
    ) -> bool:
        if nx and key in self._store:
            return False
        self._store[key] = value
        if ex is not None:
            self._ttl_store[key] = ex
        else:
            self._ttl_store.pop(key, None)
        return True

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def delete(self, key: str) -> int:
        deleted = 0
        if self._store.pop(key, None) is not None:
            deleted = 1
        if self._hash_store.pop(key, None) is not None:
            deleted = 1
        self._ttl_store.pop(key, None)
        return deleted

    async def hset(self, key: str, field: str, value: str) -> int:
        bucket = self._hash_store.setdefault(key, {})
        is_new = field not in bucket
        bucket[field] = value
        return 1 if is_new else 0

    async def hgetall(self, key: str) -> dict[str, str]:
        return dict(self._hash_store.get(key, {}))

    async def expire(self, key: str, ttl: int) -> bool:
        if key in self._store or key in self._hash_store:
            self._ttl_store[key] = ttl
            return True
        return False

    async def hdel(self, key: str, field: str) -> int:
        bucket = self._hash_store.get(key)
        if bucket is None or field not in bucket:
            return 0
        del bucket[field]
        if not bucket:
            self._hash_store.pop(key, None)
            self._ttl_store.pop(key, None)
        return 1

    async def publish(self, channel: str, message: str) -> int:
        subscribers = list(self._subscribers.get(channel, set()))
        for subscriber in subscribers:
            await subscriber.put_message(channel, message)
        return len(subscribers)

    def pubsub(self) -> FakePubSub:
        return FakePubSub(self)

    def pipeline(self) -> "FakeAsyncRedisPipeline":
        return FakeAsyncRedisPipeline(self)

    async def ping(self) -> bool:
        return True


class FakeAsyncRedisPipeline:
    """Tiny subset of Redis pipeline support used by the rate-limit middleware."""

    def __init__(self, redis: FakeAsyncRedis) -> None:
        self._redis = redis
        self._commands: list[tuple[str, tuple[Any, ...]]] = []

    def incr(self, key: str) -> "FakeAsyncRedisPipeline":
        self._commands.append(("incr", (key,)))
        return self

    def expire(self, key: str, ttl: int) -> "FakeAsyncRedisPipeline":
        self._commands.append(("expire", (key, ttl)))
        return self

    async def execute(self) -> list[int | bool]:
        results: list[int | bool] = []
        for command, args in self._commands:
            if command == "incr":
                key = args[0]
                next_value = int(self._redis._store.get(key, "0")) + 1
                self._redis._store[key] = str(next_value)
                results.append(next_value)
            elif command == "expire":
                key, ttl = args
                results.append(await self._redis.expire(key, ttl))
        self._commands.clear()
        return results


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> FakeAsyncRedis:
    redis = FakeAsyncRedis()

    monkeypatch.setattr(auth_service, "get_redis", lambda: redis)
    monkeypatch.setattr(rate_limit_module, "get_redis", lambda: redis)
    monkeypatch.setattr(search_service, "get_redis", lambda: redis)
    monkeypatch.setattr(sharing_service, "get_redis", lambda: redis)
    monkeypatch.setattr(websocket_handlers, "get_redis", lambda: redis)
    monkeypatch.setattr(websocket_manager_module, "get_redis", lambda: redis)
    monkeypatch.setattr(app_main, "get_redis", lambda: redis)

    return redis


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(content_text, '')), 'B')) STORED;"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_notes_search ON notes USING GIN(search_vector);"
            )
        )

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
