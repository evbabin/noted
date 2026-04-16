"""Quiz service — creation, retrieval, scoring, and attempt history.

Generation itself runs in ``app.tasks.quiz_tasks.generate_quiz_task``; this
module only stages the Quiz row and enqueues that task. Scoring happens here
because it's pure DB work and doesn't benefit from async job infrastructure.
"""

from __future__ import annotations

import uuid
from typing import Any

from arq.connections import ArqRedis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import NotFoundError, ValidationError
from app.models.note import Note
from app.models.quiz import QuestionType, Quiz, QuizStatus
from app.models.quiz_attempt import QuizAttempt
from app.models.quiz_question import QuizQuestion
from app.queue import queue_name
from app.schemas.quiz import QuizAttemptCreate, QuizCreate


def _default_title(note: Note) -> str:
    return f"Quiz: {note.title}"[:500]


async def create_quiz(
    db: AsyncSession,
    note: Note,
    data: QuizCreate,
    arq_pool: ArqRedis,
) -> Quiz:
    """Create a PENDING quiz row and enqueue the generation job.

    Takes the ``Note`` (already loaded by the route's RBAC dependency) so we
    can snapshot its text at enqueue time — the worker should not see later
    edits, otherwise a question may reference content the user has since
    removed.
    """
    quiz = Quiz(
        note_id=note.id,
        title=(data.title or _default_title(note)).strip()[:500],
        status=QuizStatus.PENDING,
    )
    db.add(quiz)
    await db.flush()  # populate quiz.id before enqueueing

    note_content = note.content_text or ""

    await arq_pool.enqueue_job(
        "generate_quiz_task",
        str(quiz.id),
        note_content,
        data.num_questions,
        _queue_name=queue_name(),
    )

    await db.commit()
    await db.refresh(quiz)
    return quiz


async def get_quiz(db: AsyncSession, quiz_id: uuid.UUID) -> Quiz:
    """Load a quiz with its questions ordered by ``order``."""
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz_id)
    )
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise NotFoundError("Quiz not found")
    return quiz


async def list_quizzes_for_note(db: AsyncSession, note_id: uuid.UUID) -> list[Quiz]:
    """All quizzes for a note, newest first."""
    result = await db.execute(
        select(Quiz).where(Quiz.note_id == note_id).order_by(Quiz.created_at.desc())
    )
    return list(result.scalars().all())


def _score_answer(question: QuizQuestion, user_answer: str | None) -> bool:
    """Score one answer using the same semantics exposed by the frontend.

    Flashcards are self-graded in the UI, which sends ``correct``/``incorrect``.
    We still accept raw text answers as a fallback so older clients and direct
    API consumers continue to work.
    """
    if user_answer is None:
        return False

    normalized_answer = user_answer.strip().casefold()
    if question.question_type == QuestionType.FLASHCARD:
        if normalized_answer in {"correct", "incorrect"}:
            return normalized_answer == "correct"

    return normalized_answer == question.correct_answer.strip().casefold()


async def submit_attempt(
    db: AsyncSession,
    quiz_id: uuid.UUID,
    user_id: uuid.UUID,
    data: QuizAttemptCreate,
) -> QuizAttempt:
    quiz = await get_quiz(db, quiz_id)
    if quiz.status != QuizStatus.COMPLETED:
        raise ValidationError("Quiz is not ready — wait for generation to complete")
    if not quiz.questions:
        raise ValidationError("Quiz has no questions")

    # Normalize keys — clients may send UUIDs or stringified ones; compare as strings.
    answer_map = {str(k): v for k, v in data.answers.items()}

    correct = 0
    recorded: dict[str, dict[str, Any]] = {}
    for question in quiz.questions:
        user_answer = answer_map.get(str(question.id))
        is_correct = _score_answer(question, user_answer)
        if is_correct:
            correct += 1
        recorded[str(question.id)] = {
            "answer": user_answer,
            "correct": is_correct,
        }

    total = len(quiz.questions)
    score = round((correct / total) * 100.0, 2) if total else 0.0

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user_id,
        score=score,
        total_questions=total,
        correct_count=correct,
        answers=recorded,
    )
    db.add(attempt)
    await db.flush()
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def list_attempts_for_user(
    db: AsyncSession,
    quiz_id: uuid.UUID,
    user_id: uuid.UUID,
) -> list[QuizAttempt]:
    result = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.created_at.desc())
    )
    return list(result.scalars().all())
