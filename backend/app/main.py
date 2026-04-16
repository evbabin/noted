from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.database import engine
from app.error_handlers import register_error_handlers
from app.logging import configure_logging, get_logger, register_request_logging
from app.middleware.cors import register_cors
from app.middleware.rate_limit import register_rate_limit
from app.queue import close_arq_pool
from app.redis import close_redis, get_redis
from app.routers import auth as auth_router
from app.routers import notebooks as notebooks_router
from app.routers import notes as notes_router
from app.routers import quizzes as quizzes_router
from app.routers import search as search_router
from app.routers import sharing as sharing_router
from app.routers import workspaces as workspaces_router
from app.websocket import router as websocket_router
from app.websocket.manager import manager as websocket_manager

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis = get_redis()
    try:
        await redis.ping()
        logger.info("Redis connection established")
        await websocket_manager.start_pubsub()
    except Exception:
        logger.exception("Failed to connect to Redis")

    yield

    await websocket_manager.stop_pubsub()
    await close_arq_pool()
    await close_redis()
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(level=settings.LOG_LEVEL, json_logs=settings.LOG_JSON)

    app = FastAPI(
        title=settings.APP_NAME,
        debug=settings.DEBUG,
        lifespan=lifespan,
    )

    register_cors(app)
    register_rate_limit(app)
    register_request_logging(app)
    register_error_handlers(app)

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_router.router, prefix=settings.API_V1_PREFIX)
    app.include_router(workspaces_router.router, prefix=settings.API_V1_PREFIX)
    app.include_router(
        notebooks_router.workspace_notebooks_router, prefix=settings.API_V1_PREFIX
    )
    app.include_router(notebooks_router.notebooks_router, prefix=settings.API_V1_PREFIX)
    app.include_router(
        notes_router.notebook_notes_router, prefix=settings.API_V1_PREFIX
    )
    app.include_router(notes_router.notes_router, prefix=settings.API_V1_PREFIX)
    app.include_router(
        quizzes_router.note_quizzes_router, prefix=settings.API_V1_PREFIX
    )
    app.include_router(quizzes_router.quizzes_router, prefix=settings.API_V1_PREFIX)
    app.include_router(search_router.router, prefix=settings.API_V1_PREFIX)
    app.include_router(sharing_router.router, prefix=settings.API_V1_PREFIX)
    app.include_router(websocket_router.router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()
