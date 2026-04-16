import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.workspace_member import MemberRole
from app.schemas.user import UserResponse


class WorkspaceBase(BaseModel):
    name: str
    description: str | None = None


class WorkspaceCreate(WorkspaceBase):
    pass


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class WorkspaceResponse(WorkspaceBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class WorkspaceMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    role: MemberRole
    created_at: datetime
    updated_at: datetime
    user: UserResponse | None = None


class WorkspaceWithMembersResponse(WorkspaceResponse):
    members: list[WorkspaceMemberResponse] = []


class AddWorkspaceMemberRequest(BaseModel):
    user_id: uuid.UUID
    role: MemberRole


class InviteWorkspaceMemberRequest(BaseModel):
    email: EmailStr
    role: MemberRole


class UpdateWorkspaceMemberRoleRequest(BaseModel):
    role: MemberRole


class WorkspaceInvitationResponse(BaseModel):
    workspace_id: uuid.UUID
    email: EmailStr
    role: MemberRole
    invited_by_user_id: uuid.UUID
    created_at: datetime
    status: Literal["pending"] = "pending"
