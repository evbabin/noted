import uuid
from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class Note(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notes"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    notebook = relationship("Notebook", back_populates="notes")
    versions = relationship("NoteVersion", back_populates="note", cascade="all, delete-orphan",
                            order_by="NoteVersion.version_number.desc()")
    quizzes = relationship("Quiz", back_populates="note", cascade="all, delete-orphan")
