import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.quiz import QuestionType, QuizStatus


class QuizCreate(BaseModel):
    title: str | None = None
    num_questions: int = Field(default=10, ge=3, le=20)


class QuizQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_type: QuestionType
    question_text: str
    options: dict[str, Any] | None = None
    correct_answer: str
    explanation: str | None = None
    order: int


class QuizSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    note_id: uuid.UUID
    title: str
    status: QuizStatus
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class QuizResponse(QuizSummary):
    questions: list[QuizQuestionResponse] = []


class QuizAttemptCreate(BaseModel):
    # Map of question_id (UUID string) → user's answer.
    answers: dict[str, str]


class QuizAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quiz_id: uuid.UUID
    user_id: uuid.UUID
    score: float
    total_questions: int
    correct_count: int
    answers: dict[str, Any]
    created_at: datetime
