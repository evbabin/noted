import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.database import engine
from app.error_handlers import register_error_handlers
from app.middleware.cors import register_cors
from app.redis import close_redis, get_redis

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis = get_redis()
    try:
        await redis.ping()
        logger.info("Redis connection established")
    except Exception:
        logger.exception("Failed to connect to Redis")

    yield

    await close_redis()
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.APP_NAME,
        debug=settings.DEBUG,
        lifespan=lifespan,
    )

    register_cors(app)
    register_error_handlers(app)

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
