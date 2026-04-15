from fastapi import status


class NotedException(Exception):
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    detail: str = "Internal server error"

    def __init__(self, detail: str | None = None):
        if detail is not None:
            self.detail = detail
        super().__init__(self.detail)


class NotFoundError(NotedException):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Resource not found"


class PermissionDeniedError(NotedException):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "Permission denied"


class AuthenticationError(NotedException):
    status_code = status.HTTP_401_UNAUTHORIZED
    detail = "Not authenticated"


class ValidationError(NotedException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    detail = "Validation error"


class ConflictError(NotedException):
    status_code = status.HTTP_409_CONFLICT
    detail = "Resource conflict"


class RateLimitError(NotedException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    detail = "Rate limit exceeded"
