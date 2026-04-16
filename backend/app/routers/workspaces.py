import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_min_role, require_workspace_role
from app.models.user import User
from app.models.workspace_member import MemberRole
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
    WorkspaceWithMembersResponse,
)
from app.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await workspace_service.create_workspace(db, user.id, data)


@router.get("/", response_model=list[WorkspaceResponse])
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await workspace_service.get_user_workspaces(db, user.id)


@router.get("/{workspace_id}", response_model=WorkspaceWithMembersResponse)
async def get_workspace(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership=Depends(require_min_role(MemberRole.VIEWER)),
):
    return await workspace_service.get_workspace(db, workspace_id)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: uuid.UUID,
    data: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    membership=Depends(require_workspace_role(MemberRole.OWNER)),
):
    return await workspace_service.update_workspace(db, workspace_id, data)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership=Depends(require_workspace_role(MemberRole.OWNER)),
):
    await workspace_service.delete_workspace(db, workspace_id)
