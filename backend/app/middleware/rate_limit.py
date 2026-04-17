import re
import time
from collections.abc import Awaitable, Callable

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.exceptions import RateLimitError
from app.logging import get_logger
from app.models.user import User
from app.redis import get_redis

logger = get_logger(__name__)

_PERIODS = {
    "second": 1,
    "minute": 60,
    "hour": 3600,
    "day": 86400,
}
_RATE_RE = re.compile(r"^\s*(\d+)\s*/\s*(second|minute|hour|day)s?\s*$")


def parse_rate(rate: str) -> tuple[int, int]:
    """Parse "60/minute" → (60, 60). Raises ValueError on bad input."""
    match = _RATE_RE.match(rate.lower())
    if not match:
        raise ValueError(f"Invalid rate limit expression: {rate!r}")
    count, period = match.groups()
    return int(count), _PERIODS[period]


async def _incr_window(key: str, window_seconds: int) -> int:
    redis = get_redis()
    pipe = redis.pipeline()
    pipe.incr(key)
    pipe.expire(key, window_seconds)
    count, _ = await pipe.execute()
    return int(count)


def _client_id(request: Request) -> str:
    client = request.client
    return client.host if client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window per-client rate limit on every request.

    Identifies clients by IP. Tighter per-user limits on expensive endpoints
    (AI) are applied as route dependencies via `rate_limit_dependency`.
    """

    def __init__(
        self,
        app,
        rate: str | None = None,
        exclude_paths: tuple[str, ...] = ("/health",),
    ):
        super().__init__(app)
        settings = get_settings()
        self.limit, self.window = parse_rate(rate or settings.RATE_LIMIT_DEFAULT)
        self.exclude_paths = exclude_paths

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable]
    ):
        if any(request.url.path.startswith(p) for p in self.exclude_paths):
            return await call_next(request)

        bucket = int(time.time()) // self.window
        key = f"ratelimit:global:{_client_id(request)}:{bucket}"
        try:
            count = await _incr_window(key, self.window)
        except Exception:
            logger.exception("Rate limit check failed; allowing request")
            return await call_next(request)

        if count > self.limit:
            retry_after = self.window - (int(time.time()) % self.window)
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(retry_after)},
                content={
                    "error": "RateLimitError",
                    "detail": f"Rate limit exceeded: {self.limit} per {self.window}s",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.limit - count))
        return response


def register_rate_limit(app: FastAPI) -> None:
    settings = get_settings()
    app.add_middleware(RateLimitMiddleware, rate=settings.RATE_LIMIT_DEFAULT)


def rate_limit_dependency(rate: str, scope: str):
    """Per-user rate-limit dependency factory for expensive routes (e.g. AI)."""
    from app.dependencies import get_current_user

    limit, window = parse_rate(rate)

    async def checker(user: User = Depends(get_current_user)) -> None:
        bucket = int(time.time()) // window
        key = f"ratelimit:{scope}:{user.id}:{bucket}"
        try:
            count = await _incr_window(key, window)
        except Exception:
            logger.exception("Per-user rate limit check failed; allowing request")
            return
        if count > limit:
            raise RateLimitError(f"Rate limit exceeded: {limit} per {window}s")

    return checker


def ai_rate_limit():
    settings = get_settings()
    return rate_limit_dependency(settings.RATE_LIMIT_AI, "ai")
