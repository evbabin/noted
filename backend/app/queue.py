"""Lazy ARQ pool accessor for enqueueing background jobs from the API.

Mirrors the pattern in ``app.redis`` — a single module-level pool created on
first use and closed in the app lifespan. We intentionally keep this out of
``app.redis`` because ARQ needs its own RedisSettings-configured pool (not
the generic ``redis.asyncio`` pool used for caching / presence).
"""

from __future__ import annotations

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.config import get_settings
from app.logging import get_logger
from app.tasks.worker import WorkerSettings

logger = get_logger(__name__)

_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        redis_settings = RedisSettings.from_dsn(get_settings().REDIS_URL)
        _pool = await create_pool(redis_settings)
    return _pool


async def close_arq_pool() -> None:
    global _pool
    if _pool is not None:
        try:
            await _pool.aclose()
        except Exception:
            logger.exception("Failed to close ARQ pool")
        _pool = None


def queue_name() -> str:
    """The queue name jobs should be enqueued on — must match the worker."""
    return WorkerSettings.queue_name
