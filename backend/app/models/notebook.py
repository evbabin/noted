import uuid
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class Notebook(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notebooks"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    workspace = relationship("Workspace", back_populates="notebooks")
    notes = relationship("Note", back_populates="notebook", cascade="all, delete-orphan",
                         order_by="Note.sort_order")
