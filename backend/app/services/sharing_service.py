"""Workspace sharing service.

Owners can invite existing users by email, manage member roles, and remove
members. If the email is not registered yet, we keep a pending invite in Redis
 so the membership can be applied when that account is created later.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from app.models.note import Note
from app.models.notebook import Notebook
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_member import MemberRole, WorkspaceMember
from app.redis import get_redis
from app.schemas.workspace import WorkspaceInvitationResponse
from app.websocket.manager import manager as websocket_manager

_INVITE_TTL_SECONDS = 7 * 24 * 60 * 60


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _pending_invites_key(email: str) -> str:
    return f"workspace-invites:{_normalize_email(email)}"


async def _get_workspace(db: AsyncSession, workspace_id: uuid.UUID) -> Workspace:
    workspace = await db.get(Workspace, workspace_id)
    if workspace is None:
        raise NotFoundError("Workspace not found")
    return workspace


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    normalized_email = _normalize_email(email)
    result = await db.execute(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    return result.scalar_one_or_none()


async def _get_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
) -> WorkspaceMember:
    result = await db.execute(
        select(WorkspaceMember)
        .options(selectinload(WorkspaceMember.user))
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise NotFoundError("Workspace member not found")
    return member


async def _load_member_by_id(db: AsyncSession, member_id: uuid.UUID) -> WorkspaceMember:
    result = await db.execute(
        select(WorkspaceMember)
        .options(selectinload(WorkspaceMember.user))
        .where(WorkspaceMember.id == member_id)
    )
    return result.scalar_one()


async def _find_existing_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
) -> WorkspaceMember | None:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _upsert_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    role: MemberRole,
) -> WorkspaceMember:
    member = await _find_existing_member(db, workspace_id, user_id)
    if member is None:
        member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=user_id,
            role=role,
        )
        db.add(member)
    else:
        member.role = role

    await db.flush()
    return await _load_member_by_id(db, member.id)


async def _other_owner(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    excluded_user_id: uuid.UUID,
) -> WorkspaceMember | None:
    result = await db.execute(
        select(WorkspaceMember)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.role == MemberRole.OWNER,
            WorkspaceMember.user_id != excluded_user_id,
        )
        .order_by(WorkspaceMember.created_at.asc())
    )
    return result.scalars().first()


async def _pending_invites_for_email(email: str) -> list[dict[str, Any]]:
    redis = get_redis()
    raw = await redis.get(_pending_invites_key(email))
    if raw is None:
        return []

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return []

    if not isinstance(payload, list):
        return []

    return [item for item in payload if isinstance(item, dict)]


async def _store_pending_invitation(
    workspace_id: uuid.UUID,
    email: str,
    role: MemberRole,
    invited_by_user_id: uuid.UUID,
) -> WorkspaceInvitationResponse:
    normalized_email = _normalize_email(email)
    invites = [
        invite
        for invite in await _pending_invites_for_email(normalized_email)
        if invite.get("workspace_id") != str(workspace_id)
    ]

    created_at = datetime.now(UTC)
    invite_payload = {
        "workspace_id": str(workspace_id),
        "email": normalized_email,
        "role": role.value,
        "invited_by_user_id": str(invited_by_user_id),
        "created_at": created_at.isoformat(),
    }
    invites.append(invite_payload)

    redis = get_redis()
    await redis.set(
        _pending_invites_key(normalized_email),
        json.dumps(invites),
        ex=_INVITE_TTL_SECONDS,
    )

    return WorkspaceInvitationResponse(
        workspace_id=workspace_id,
        email=normalized_email,
        role=role,
        invited_by_user_id=invited_by_user_id,
        created_at=created_at,
    )


async def accept_pending_invitations(
    db: AsyncSession,
    user: User,
) -> list[WorkspaceMember]:
    invites = await _pending_invites_for_email(user.email)
    if not invites:
        return []

    applied_memberships: list[WorkspaceMember] = []
    for invite in invites:
        workspace_id_raw = invite.get("workspace_id")
        role_raw = invite.get("role")
        if not isinstance(workspace_id_raw, str) or not isinstance(role_raw, str):
            continue

        try:
            workspace_id = uuid.UUID(workspace_id_raw)
            role = MemberRole(role_raw)
        except ValueError:
            continue

        workspace = await db.get(Workspace, workspace_id)
        if workspace is None:
            continue

        membership = await _upsert_member(db, workspace_id, user.id, role)
        applied_memberships.append(membership)

    redis = get_redis()
    await redis.delete(_pending_invites_key(user.email))
    return applied_memberships


async def invite_workspace_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    email: str,
    role: MemberRole,
    acting_user: User,
) -> WorkspaceMember | WorkspaceInvitationResponse:
    """Invite a user by email or stash a pending invitation for later signup."""
    normalized_email = _normalize_email(email)
    if normalized_email == _normalize_email(acting_user.email):
        raise ValidationError("Owners cannot invite themselves")

    await _get_workspace(db, workspace_id)

    invited_user = await _get_user_by_email(db, normalized_email)
    if invited_user is None:
        return await _store_pending_invitation(
            workspace_id=workspace_id,
            email=normalized_email,
            role=role,
            invited_by_user_id=acting_user.id,
        )

    existing_member = await _find_existing_member(db, workspace_id, invited_user.id)
    if existing_member is not None:
        raise ConflictError("User is already a workspace member")

    return await _upsert_member(db, workspace_id, invited_user.id, role)


async def list_workspace_members(
    db: AsyncSession,
    workspace_id: uuid.UUID,
) -> list[WorkspaceMember]:
    await _get_workspace(db, workspace_id)
    result = await db.execute(
        select(WorkspaceMember)
        .options(selectinload(WorkspaceMember.user))
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.created_at.asc())
    )
    return list(result.scalars().all())


async def update_workspace_member_role(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    role: MemberRole,
) -> WorkspaceMember:
    workspace = await _get_workspace(db, workspace_id)
    member = await _get_member(db, workspace_id, user_id)
    if member.role == role:
        return member

    if member.role == MemberRole.OWNER and role != MemberRole.OWNER:
        replacement_owner = await _other_owner(db, workspace_id, member.user_id)
        if replacement_owner is None:
            raise PermissionDeniedError("Cannot demote the last owner of the workspace")
        if workspace.owner_id == member.user_id:
            workspace.owner_id = replacement_owner.user_id

    member.role = role
    await db.flush()
    return await _load_member_by_id(db, member.id)


async def _workspace_note_ids(
    db: AsyncSession,
    workspace_id: uuid.UUID,
) -> list[uuid.UUID]:
    result = await db.execute(
        select(Note.id)
        .join(Notebook, Note.notebook_id == Notebook.id)
        .where(Notebook.workspace_id == workspace_id)
    )
    return list(result.scalars().all())


async def remove_workspace_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    acting_user_id: uuid.UUID,
) -> None:
    workspace = await _get_workspace(db, workspace_id)
    if user_id == acting_user_id:
        raise ValidationError("Owners cannot remove themselves from a workspace")

    member = await _get_member(db, workspace_id, user_id)
    if member.role == MemberRole.OWNER:
        replacement_owner = await _other_owner(db, workspace_id, member.user_id)
        if replacement_owner is None:
            raise PermissionDeniedError("Cannot remove the last owner of the workspace")
        if workspace.owner_id == member.user_id:
            workspace.owner_id = replacement_owner.user_id

    note_ids = await _workspace_note_ids(db, workspace_id)
    await db.delete(member)
    await db.flush()

    # Membership revocation must tear down any active collaboration sessions so
    # editors do not keep websocket access after the HTTP permission is gone.
    await websocket_manager.close_user_connections(note_ids, user_id)
