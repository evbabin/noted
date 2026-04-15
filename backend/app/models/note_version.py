import uuid
from sqlalchemy import Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class NoteVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "note_versions"

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    edited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    note = relationship("Note", back_populates="versions")
    editor = relationship("User")
