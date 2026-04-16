"""ARQ worker entrypoint.

Run with: `arq app.tasks.worker.WorkerSettings`

Phase 5 task 5.1 scaffolds the worker itself. Individual tasks (quiz
generation, search indexing) are registered in `WorkerSettings.functions`
as they land in later tasks.
"""

from __future__ import annotations

from typing import Any

from arq.connections import RedisSettings

from app.config import get_settings
from app.logging import configure_logging, get_logger
from app.tasks.quiz_tasks import generate_quiz_task

settings = get_settings()
configure_logging(level=settings.LOG_LEVEL, json_logs=settings.LOG_JSON)

logger = get_logger(__name__)


def _redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.REDIS_URL)


async def startup(ctx: dict[str, Any]) -> None:
    logger.info("ARQ worker starting", queue_name=WorkerSettings.queue_name)


async def shutdown(ctx: dict[str, Any]) -> None:
    logger.info("ARQ worker shutting down")


async def ping(ctx: dict[str, Any]) -> str:
    """Health-check task used to verify the worker is reachable."""
    return "pong"


class WorkerSettings:
    """ARQ configuration.

    Task functions are appended here as they are implemented:
      - 5.3: `generate_quiz_task` from `app.tasks.quiz_tasks`
      - Phase 6+: search index updates from `app.tasks.search_tasks`
    """

    functions: list[Any] = [ping, generate_quiz_task]
    redis_settings: RedisSettings = _redis_settings()
    on_startup = startup
    on_shutdown = shutdown
    queue_name: str = "noted:jobs"
    max_jobs: int = 10
    job_timeout: int = 300  # seconds — covers Anthropic quiz generation latency
    keep_result: int = 3600  # keep job results for 1h so the API can poll status
