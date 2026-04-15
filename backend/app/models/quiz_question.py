import uuid
from sqlalchemy import Text, Integer, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin
from app.models.quiz import QuestionType


class QuizQuestion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quiz_questions"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False
    )
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    quiz = relationship("Quiz", back_populates="questions")
