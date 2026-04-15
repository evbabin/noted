from redis.asyncio import ConnectionPool, Redis

from app.config import get_settings

_pool: ConnectionPool | None = None


def get_redis_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)
    return _pool


def get_redis() -> Redis:
    return Redis(connection_pool=get_redis_pool())


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        await _pool.disconnect()
        _pool = None
