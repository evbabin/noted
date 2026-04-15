import uuid
import enum
from sqlalchemy import String, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class QuizStatus(str, enum.Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    FILL_IN_THE_BLANK = "fill_in_the_blank"
    FLASHCARD = "flashcard"


class Quiz(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quizzes"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[QuizStatus] = mapped_column(
        Enum(QuizStatus), default=QuizStatus.PENDING, nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    note = relationship("Note", back_populates="quizzes")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan",
                             order_by="QuizQuestion.order")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")
