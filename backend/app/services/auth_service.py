import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import bcrypt
import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.exceptions import AuthenticationError, ConflictError
from app.models.user import User
from app.redis import get_redis
from app.schemas.auth import RegisterRequest

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

settings = get_settings()

REFRESH_PREFIX = "refresh:"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: uuid.UUID, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
        "jti": secrets.token_urlsafe(16),
    }
    return _encode(payload)


def create_refresh_token(user_id: uuid.UUID) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(16)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).timestamp()),
        "jti": jti,
    }
    return _encode(payload), jti


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as e:
        raise AuthenticationError("Token has expired") from e
    except jwt.InvalidTokenError as e:
        raise AuthenticationError("Invalid token") from e


def _refresh_key(user_id: str, jti: str) -> str:
    return f"{REFRESH_PREFIX}{user_id}:{jti}"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def store_refresh_token(token: str, user_id: uuid.UUID, jti: str) -> None:
    redis = get_redis()
    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    await redis.setex(_refresh_key(str(user_id), jti), ttl, _hash_token(token))


async def invalidate_refresh_token(user_id: str, jti: str) -> None:
    redis = get_redis()
    await redis.delete(_refresh_key(user_id, jti))


async def verify_refresh_token(token: str) -> dict:
    claims = decode_token(token)
    if claims.get("type") != "refresh":
        raise AuthenticationError("Invalid refresh token")
    redis = get_redis()
    stored = await redis.get(_refresh_key(claims["sub"], claims["jti"]))
    if stored is None or stored != _hash_token(token):
        raise AuthenticationError("Refresh token is no longer valid")
    return claims


async def issue_token_pair(user: User) -> tuple[str, str]:
    access = create_access_token(user.id, user.email)
    refresh, jti = create_refresh_token(user.id)
    await store_refresh_token(refresh, user.id, jti)
    return access, refresh


async def rotate_refresh_token(token: str, db: AsyncSession) -> tuple[User, str, str]:
    claims = await verify_refresh_token(token)
    await invalidate_refresh_token(claims["sub"], claims["jti"])
    user = await db.get(User, uuid.UUID(claims["sub"]))
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive")
    access, refresh = await issue_token_pair(user)
    return user, access, refresh


async def register_user(db: AsyncSession, data: RegisterRequest) -> User:
    from app.services import sharing_service

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none() is not None:
        raise ConflictError("A user with this email already exists")
    user = User(
        email=data.email,
        display_name=data.display_name,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    await db.flush()
    await sharing_service.accept_pending_invitations(db, user)
    await db.refresh(user)
    return user


def google_authorization_url(state: str | None = None) -> str:
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    if state:
        params["state"] = state
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def google_oauth_flow(db: AsyncSession, code: str) -> User:
    from app.services import sharing_service

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise AuthenticationError("Google OAuth is not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise AuthenticationError("Failed to exchange Google authorization code")
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise AuthenticationError("Google did not return an access token")

        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise AuthenticationError("Failed to fetch Google profile")
        info = userinfo_resp.json()

    google_id = info.get("sub")
    email = info.get("email")
    if not google_id or not email:
        raise AuthenticationError("Google profile missing required fields")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is not None:
            user.google_id = google_id
            if not user.avatar_url and info.get("picture"):
                user.avatar_url = info["picture"]
            user.is_verified = user.is_verified or bool(info.get("email_verified"))
        else:
            user = User(
                email=email,
                display_name=info.get("name") or email.split("@")[0],
                google_id=google_id,
                avatar_url=info.get("picture"),
                is_verified=bool(info.get("email_verified")),
                is_active=True,
            )
            db.add(user)

    if user.is_active is False:
        raise AuthenticationError("Account is disabled")

    await db.flush()
    await sharing_service.accept_pending_invitations(db, user)
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or user.hashed_password is None:
        raise AuthenticationError("Invalid email or password")
    if not verify_password(password, user.hashed_password):
        raise AuthenticationError("Invalid email or password")
    if not user.is_active:
        raise AuthenticationError("Account is disabled")
    return user
