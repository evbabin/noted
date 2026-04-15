import uuid
import enum
from sqlalchemy import ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class MemberRole(str, enum.Enum):
    OWNER = "owner"
    EDITOR = "editor"
    COMMENTER = "commenter"
    VIEWER = "viewer"


class WorkspaceMember(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "workspace_members"
    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MemberRole] = mapped_column(
        Enum(MemberRole), default=MemberRole.VIEWER, nullable=False
    )

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="workspace_memberships")
