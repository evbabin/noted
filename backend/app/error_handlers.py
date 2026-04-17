from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions import NotedException
from app.logging import REQUEST_ID_HEADER, get_logger, get_request_id

logger = get_logger(__name__)


def _response_headers(request: Request) -> dict[str, str]:
    request_id = get_request_id(request)
    if request_id is None:
        return {}
    return {REQUEST_ID_HEADER: request_id}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotedException)
    async def noted_exception_handler(
        request: Request, exc: NotedException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.__class__.__name__, "detail": exc.detail},
            headers=_response_headers(request),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": "HTTPException", "detail": exc.detail},
            headers=_response_headers(request),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "ValidationError", "detail": exc.errors()},
            headers=_response_headers(request),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception("Unhandled exception")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "InternalServerError", "detail": "Internal server error"},
            headers=_response_headers(request),
        )
