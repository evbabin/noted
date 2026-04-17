from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    get_current_user,
    get_db,
    require_min_role,
    require_workspace_role,
)
from app.models.user import User
from app.models.workspace_member import MemberRole
from app.schemas.workspace import (
    InviteWorkspaceMemberRequest,
    UpdateWorkspaceMemberRoleRequest,
    WorkspaceInvitationResponse,
    WorkspaceMemberResponse,
)
from app.services import sharing_service

router = APIRouter(prefix="/workspaces", tags=["sharing"])


@router.post(
    "/{workspace_id}/invitations",
    response_model=WorkspaceMemberResponse | WorkspaceInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/{workspace_id}/members",
    response_model=WorkspaceMemberResponse | WorkspaceInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invite_workspace_member(
    workspace_id: uuid.UUID,
    data: InviteWorkspaceMemberRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _membership=Depends(require_workspace_role(MemberRole.OWNER)),
):
    invite_result = await sharing_service.invite_workspace_member(
        db=db,
        workspace_id=workspace_id,
        email=str(data.email),
        role=data.role,
        acting_user=user,
    )
    if isinstance(invite_result, WorkspaceInvitationResponse):
        response.status_code = status.HTTP_202_ACCEPTED
    return invite_result


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
async def list_workspace_members(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _membership=Depends(require_min_role(MemberRole.VIEWER)),
):
    return await sharing_service.list_workspace_members(db, workspace_id)


@router.patch(
    "/{workspace_id}/members/{user_id}", response_model=WorkspaceMemberResponse
)
async def update_workspace_member_role(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    data: UpdateWorkspaceMemberRoleRequest,
    db: AsyncSession = Depends(get_db),
    _membership=Depends(require_workspace_role(MemberRole.OWNER)),
):
    return await sharing_service.update_workspace_member_role(
        db=db,
        workspace_id=workspace_id,
        user_id=user_id,
        role=data.role,
    )


@router.delete(
    "/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_workspace_member(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _membership=Depends(require_workspace_role(MemberRole.OWNER)),
):
    await sharing_service.remove_workspace_member(
        db=db,
        workspace_id=workspace_id,
        user_id=user_id,
        acting_user_id=user.id,
    )
