import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import NotFoundError, PermissionDeniedError
from app.models.workspace import Workspace
from app.models.workspace_member import MemberRole, WorkspaceMember
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate


async def create_workspace(
    db: AsyncSession, user_id: uuid.UUID, data: WorkspaceCreate
) -> Workspace:
    workspace = Workspace(
        name=data.name,
        description=data.description,
        owner_id=user_id,
    )
    db.add(workspace)
    await db.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user_id,
        role=MemberRole.OWNER,
    )
    db.add(member)
    await db.flush()
    await db.refresh(workspace)
    return workspace


async def get_user_workspaces(
    db: AsyncSession, user_id: uuid.UUID
) -> Sequence[Workspace]:
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(Workspace.created_at.desc())
    )
    return result.scalars().all()


async def get_workspace(db: AsyncSession, workspace_id: uuid.UUID) -> Workspace:
    result = await db.execute(
        select(Workspace)
        .options(selectinload(Workspace.members).selectinload(WorkspaceMember.user))
        .where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise NotFoundError("Workspace not found")
    return workspace


async def update_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, data: WorkspaceUpdate
) -> Workspace:
    workspace = await get_workspace(db, workspace_id)
    if data.name is not None:
        workspace.name = data.name
    if data.description is not None:
        workspace.description = data.description

    await db.flush()
    await db.refresh(workspace)
    return workspace


async def delete_workspace(db: AsyncSession, workspace_id: uuid.UUID) -> None:
    workspace = await get_workspace(db, workspace_id)
    await db.delete(workspace)
    await db.flush()


async def add_workspace_member(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID, role: MemberRole
) -> WorkspaceMember:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member:
        member.role = role
    else:
        member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=user_id,
            role=role,
        )
        db.add(member)

    await db.flush()

    result = await db.execute(
        select(WorkspaceMember)
        .options(selectinload(WorkspaceMember.user))
        .where(WorkspaceMember.id == member.id)
    )
    return result.scalar_one()


async def remove_workspace_member(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise NotFoundError("Workspace member not found")

    if member.role == MemberRole.OWNER:
        owner_result = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.role == MemberRole.OWNER,
            )
        )
        owners = owner_result.scalars().all()
        if len(owners) <= 1:
            raise PermissionDeniedError("Cannot remove the last owner of the workspace")

    await db.delete(member)
    await db.flush()
