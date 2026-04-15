import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions import NotedException

logger = logging.getLogger(__name__)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotedException)
    async def noted_exception_handler(_: Request, exc: NotedException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.__class__.__name__, "detail": exc.detail},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "HTTPException", "detail": exc.detail},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "ValidationError", "detail": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "InternalServerError", "detail": "Internal server error"},
        )
