from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await auth_service.register_user(db, data)
    access, refresh = await auth_service.issue_token_pair(user)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await auth_service.authenticate_user(db, data.email, data.password)
    access, refresh = await auth_service.issue_token_pair(user)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    _, access, refresh_token = await auth_service.rotate_refresh_token(data.refresh_token, db)
    return TokenPair(access_token=access, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    data: LogoutRequest,
    _: User = Depends(get_current_user),
) -> Response:
    try:
        claims = auth_service.decode_token(data.refresh_token)
        if claims.get("type") == "refresh" and "sub" in claims and "jti" in claims:
            await auth_service.invalidate_refresh_token(claims["sub"], claims["jti"])
    except Exception:
        pass
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/google")
async def google_login(state: str | None = Query(default=None)) -> RedirectResponse:
    return RedirectResponse(
        url=auth_service.google_authorization_url(state),
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/google/callback", response_model=TokenResponse)
async def google_callback(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await auth_service.google_oauth_flow(db, code)
    access, refresh = await auth_service.issue_token_pair(user)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserResponse.model_validate(user),
    )


@router.post("/password-reset", response_model=MessageResponse)
async def password_reset(data: PasswordResetRequest) -> MessageResponse:
    _ = data.email
    return MessageResponse(
        message="If an account exists for this email, a password reset link has been sent."
    )


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)
