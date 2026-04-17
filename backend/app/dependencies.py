import uuid
from collections.abc import AsyncIterator, Iterable

from fastapi import Depends, Path
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.exceptions import AuthenticationError, NotFoundError, PermissionDeniedError
from app.models.note import Note
from app.models.notebook import Notebook
from app.models.user import User
from app.models.workspace_member import MemberRole, WorkspaceMember
from app.services import auth_service

settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False
)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise AuthenticationError("Not authenticated")
    claims = auth_service.decode_token(token)
    if claims.get("type") != "access":
        raise AuthenticationError("Invalid token type")
    try:
        user_id = uuid.UUID(claims["sub"])
    except (KeyError, ValueError) as e:
        raise AuthenticationError("Invalid token subject") from e
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive")
    return user


_ROLE_RANK = {
    MemberRole.VIEWER: 0,
    MemberRole.COMMENTER: 1,
    MemberRole.EDITOR: 2,
    MemberRole.OWNER: 3,
}


def require_workspace_role(*allowed_roles: MemberRole):
    """Dependency factory enforcing membership + role on workspace-scoped endpoints.

    404 (not 403) when the user has no membership — don't leak workspace existence.
    """
    allowed = set(allowed_roles)

    async def checker(
        workspace_id: uuid.UUID = Path(...),
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> WorkspaceMember:
        result = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user.id,
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise NotFoundError("Workspace not found")
        if allowed and membership.role not in allowed:
            raise PermissionDeniedError("Insufficient workspace role")
        return membership

    return checker


def require_min_role(min_role: MemberRole):
    """Convenience wrapper: allow `min_role` and any role above it in the hierarchy."""
    threshold = _ROLE_RANK[min_role]
    allowed: Iterable[MemberRole] = [
        r for r, rank in _ROLE_RANK.items() if rank >= threshold
    ]
    return require_workspace_role(*allowed)


def require_notebook_role(*allowed_roles: MemberRole):
    """Dependency factory enforcing membership + role on notebook-scoped endpoints."""
    allowed = set(allowed_roles)

    async def checker(
        notebook_id: uuid.UUID = Path(...),
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> Notebook:
        notebook = await db.get(Notebook, notebook_id)
        if not notebook:
            raise NotFoundError("Notebook not found")

        result = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == notebook.workspace_id,
                WorkspaceMember.user_id == user.id,
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise NotFoundError("Workspace not found")
        if allowed and membership.role not in allowed:
            raise PermissionDeniedError("Insufficient workspace role")
        return notebook

    return checker


def require_min_notebook_role(min_role: MemberRole):
    threshold = _ROLE_RANK[min_role]
    allowed: Iterable[MemberRole] = [
        r for r, rank in _ROLE_RANK.items() if rank >= threshold
    ]
    return require_notebook_role(*allowed)


def require_note_role(*allowed_roles: MemberRole):
    """Dependency factory enforcing membership + role on note-scoped endpoints.

    Resolves note → notebook → workspace → member role. Returns 404 for
    missing notes and non-members (don't leak existence); 403 for insufficient role.
    """
    allowed = set(allowed_roles)

    async def checker(
        note_id: uuid.UUID = Path(...),
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> Note:
        note = await db.get(Note, note_id)
        if not note:
            raise NotFoundError("Note not found")
        notebook = await db.get(Notebook, note.notebook_id)
        if not notebook:
            raise NotFoundError("Note not found")

        result = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == notebook.workspace_id,
                WorkspaceMember.user_id == user.id,
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise NotFoundError("Note not found")
        if allowed and membership.role not in allowed:
            raise PermissionDeniedError("Insufficient workspace role")
        return note

    return checker


def require_min_note_role(min_role: MemberRole):
    threshold = _ROLE_RANK[min_role]
    allowed: Iterable[MemberRole] = [
        r for r, rank in _ROLE_RANK.items() if rank >= threshold
    ]
    return require_note_role(*allowed)
