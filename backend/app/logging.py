"""Structured logging configuration shared by the API and worker processes.

We keep logging setup in one module so the FastAPI app and the ARQ worker emit
the same JSON/console log shape. Request middleware binds per-request context
via structlog contextvars, which lets downstream logs automatically include the
request identifier without threading that value through every call manually.
"""

from __future__ import annotations

import logging
import sys
import time
import uuid

import structlog
from fastapi import FastAPI, Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "X-Request-ID"


def configure_logging(*, level: str, json_logs: bool) -> None:
    """Configure stdlib + structlog once for the current process."""
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.ExtraAdder(),
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    renderer = (
        structlog.processors.JSONRenderer()
        if json_logs
        else structlog.dev.ConsoleRenderer()
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(level.upper())

    # Uvicorn's access log becomes redundant once we emit our own request-level
    # structured events with request IDs and timing metadata.
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers.clear()
    access_logger.propagate = False

    for logger_name in ("uvicorn", "uvicorn.error", "arq", "fastapi"):
        named_logger = logging.getLogger(logger_name)
        named_logger.handlers.clear()
        named_logger.propagate = True

    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            *shared_processors,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.UnicodeDecoder(),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.stdlib.get_logger(name)


def get_request_id(request: Request) -> str | None:
    request_id = getattr(request.state, "request_id", None)
    if request_id is None:
        return None
    return str(request_id)


class RequestLoggingMiddleware:
    """Bind request context and emit start/finish events for every HTTP request."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.logger = get_logger("app.http")

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        client = request.client.host if request.client else "unknown"
        started_at = time.perf_counter()

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=client,
        )
        scope.setdefault("state", {})["request_id"] = request_id

        self.logger.info("request_started")

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                request_id_header = REQUEST_ID_HEADER.lower().encode()
                headers = [
                    header
                    for header in list(message.get("headers", []))
                    if header[0] != request_id_header
                ]
                headers.append((request_id_header, request_id.encode()))
                message["headers"] = headers

                duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
                self.logger.info(
                    "request_finished",
                    status_code=message["status"],
                    duration_ms=duration_ms,
                )

            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
            self.logger.exception("request_failed", duration_ms=duration_ms)
            raise
        finally:
            structlog.contextvars.clear_contextvars()


def register_request_logging(app: FastAPI) -> None:
    app.add_middleware(RequestLoggingMiddleware)
