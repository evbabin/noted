"""ARQ background task: AI quiz generation.

Triggered by ``POST /notes/{note_id}/quizzes``. The router creates a ``Quiz``
row in ``PENDING`` state and enqueues ``generate_quiz_task`` with the quiz id
and the current note content. The task then:

    PENDING  ──►  GENERATING  ──►  COMPLETED
                                \\
                                 └─►  FAILED  (error_message populated)

We take a snapshot of ``note_content`` at enqueue time instead of re-reading
the note inside the worker so that concurrent edits during generation don't
produce questions that reference text the user has already removed.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.quiz import Quiz, QuizStatus
from app.models.quiz_question import QuizQuestion
from app.services import ai_service

logger = logging.getLogger(__name__)

# Bounds chosen to match the Feature 5 acceptance criteria ("8-12 questions of
# mixed types"). Kept here rather than in settings because they're tied to the
# prompt template in ai_service, not something an operator should tune at runtime.
DEFAULT_NUM_QUESTIONS = 10
MIN_CONTENT_CHARS = 50  # below this, the model has nothing useful to quiz on


async def generate_quiz_task(
    ctx: dict[str, Any],
    quiz_id: str,
    note_content: str,
    num_questions: int = DEFAULT_NUM_QUESTIONS,
) -> dict[str, Any]:
    """Generate quiz questions for ``quiz_id`` from ``note_content``.

    Runs inside the ARQ worker. Returns a small status dict so that
    ``keep_result`` lets the API surface failure details if polling.

    We open a fresh ``AsyncSession`` per job rather than sharing one via
    ``ctx`` — ARQ runs jobs concurrently (``max_jobs=10``) and SQLAlchemy
    async sessions are not safe to share across tasks.
    """
    quiz_uuid = UUID(quiz_id)

    async with AsyncSessionLocal() as db:
        quiz = await _load_quiz(db, quiz_uuid)
        if quiz is None:
            # Quiz row was deleted between enqueue and execution — nothing to do.
            logger.warning("generate_quiz_task: quiz %s not found, skipping", quiz_id)
            return {"quiz_id": quiz_id, "status": "missing"}

        # Fail fast on empty notes so we don't burn an AI call (and an
        # acceptance criterion: empty content → FAILED with error_message).
        if not note_content or len(note_content.strip()) < MIN_CONTENT_CHARS:
            await _mark_failed(
                db,
                quiz,
                "Note content is too short to generate a quiz.",
            )
            return {"quiz_id": quiz_id, "status": QuizStatus.FAILED.value}

        quiz.status = QuizStatus.GENERATING
        quiz.error_message = None
        await db.commit()

        try:
            provider = ai_service.get_ai_provider()
            questions = await provider.generate_quiz_from_content(
                content=note_content,
                num_questions=num_questions,
            )
        except Exception as exc:  # noqa: BLE001 — we want any provider error to mark FAILED
            # Log with traceback for debugging; persist a user-safe message.
            logger.exception("Quiz generation failed for quiz_id=%s", quiz_id)
            await _mark_failed(db, quiz, f"AI provider error: {exc}")
            return {"quiz_id": quiz_id, "status": QuizStatus.FAILED.value}

        if not questions:
            await _mark_failed(db, quiz, "AI provider returned no questions.")
            return {"quiz_id": quiz_id, "status": QuizStatus.FAILED.value}

        try:
            _persist_questions(db, quiz_uuid, questions)
            quiz.status = QuizStatus.COMPLETED
            quiz.error_message = None
            await db.commit()
        except Exception as exc:  # noqa: BLE001 — validation / DB insert failures
            await db.rollback()
            logger.exception("Persisting quiz questions failed for quiz_id=%s", quiz_id)
            # Reload after rollback so the FAILED update lands on a clean session state.
            quiz = await _load_quiz(db, quiz_uuid)
            if quiz is not None:
                await _mark_failed(db, quiz, f"Invalid question format: {exc}")
            return {"quiz_id": quiz_id, "status": QuizStatus.FAILED.value}

        logger.info(
            "Quiz %s generated with %d questions",
            quiz_id,
            len(questions),
        )
        return {
            "quiz_id": quiz_id,
            "status": QuizStatus.COMPLETED.value,
            "question_count": len(questions),
        }


async def _load_quiz(db: AsyncSession, quiz_id: UUID) -> Quiz | None:
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    return result.scalar_one_or_none()


async def _mark_failed(db: AsyncSession, quiz: Quiz, message: str) -> None:
    """Persist a FAILED state with a user-visible error message."""
    quiz.status = QuizStatus.FAILED
    quiz.error_message = message
    await db.commit()


def _persist_questions(
    db: AsyncSession,
    quiz_id: UUID,
    questions: list[dict[str, Any]],
) -> None:
    """Insert ``QuizQuestion`` rows.

    Only pulls whitelisted keys out of each dict — the AI response may
    include extra fields (e.g. a stray ``id`` or ``difficulty``) that would
    break ``QuizQuestion(**q)`` with a TypeError. The ``order`` field is
    assigned from the list index so questions render in the order the model
    returned them.
    """
    allowed = {"question_type", "question_text", "options", "correct_answer", "explanation"}
    for i, q in enumerate(questions):
        payload = {k: v for k, v in q.items() if k in allowed}
        db.add(QuizQuestion(quiz_id=quiz_id, order=i, **payload))
