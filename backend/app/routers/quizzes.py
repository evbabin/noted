"""Quiz endpoints.

Two routers because quiz creation/listing is note-scoped (`/notes/{note_id}/...`)
while single-quiz reads and attempts are keyed by quiz id. Same split pattern
as ``routers/notes.py``.
"""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    get_current_user,
    get_db,
    require_min_note_role,
)
from app.exceptions import NotFoundError, PermissionDeniedError
from app.middleware.rate_limit import ai_rate_limit
from app.models.note import Note
from app.models.notebook import Notebook
from app.models.user import User
from app.models.workspace_member import MemberRole, WorkspaceMember
from app.queue import get_arq_pool
from app.schemas.quiz import (
    QuizAttemptCreate,
    QuizAttemptResponse,
    QuizCreate,
    QuizResponse,
    QuizSummary,
)
from app.services import quiz_service
from sqlalchemy import select

note_quizzes_router = APIRouter(
    prefix="/notes/{note_id}/quizzes",
    tags=["quizzes"],
)


@note_quizzes_router.post(
    "",
    response_model=QuizSummary,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_quiz(
    note_id: uuid.UUID,
    data: QuizCreate,
    db: AsyncSession = Depends(get_db),
    note: Note = Depends(require_min_note_role(MemberRole.COMMENTER)),
    rate_limit=Depends(ai_rate_limit()),
):
    """Kick off background quiz generation.

    Returns 202 with the quiz in ``PENDING`` state — clients poll
    ``GET /quizzes/{id}`` to see status transitions.
    """
    arq_pool = await get_arq_pool()
    quiz = await quiz_service.create_quiz(db, note, data, arq_pool)
    return quiz


@note_quizzes_router.get("", response_model=list[QuizSummary])
async def list_quizzes(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _note: Note = Depends(require_min_note_role(MemberRole.VIEWER)),
):
    return await quiz_service.list_quizzes_for_note(db, note_id)


quizzes_router = APIRouter(prefix="/quizzes", tags=["quizzes"])


async def _load_quiz_with_membership(
    quiz_id: uuid.UUID,
    db: AsyncSession,
    user: User,
    min_role: MemberRole = MemberRole.VIEWER,
):
    """RBAC for quiz-id-scoped routes.

    ``require_min_note_role`` takes ``note_id`` from the path; quiz routes
    only carry ``quiz_id``, so we resolve quiz → note → notebook → workspace
    → membership manually. 404 for non-members, mirroring the project's
    "don't leak existence" convention.
    """
    quiz = await quiz_service.get_quiz(db, quiz_id)
    note = await db.get(Note, quiz.note_id)
    if note is None:
        raise NotFoundError("Quiz not found")
    notebook = await db.get(Notebook, note.notebook_id)
    if notebook is None:
        raise NotFoundError("Quiz not found")

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == notebook.workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError("Quiz not found")

    from app.dependencies import _ROLE_RANK

    if _ROLE_RANK[membership.role] < _ROLE_RANK[min_role]:
        raise PermissionDeniedError("Insufficient workspace role")

    return quiz


@quizzes_router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _load_quiz_with_membership(quiz_id, db, user)


@quizzes_router.post(
    "/{quiz_id}/attempts",
    response_model=QuizAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_attempt(
    quiz_id: uuid.UUID,
    data: QuizAttemptCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _load_quiz_with_membership(quiz_id, db, user, min_role=MemberRole.VIEWER)
    return await quiz_service.submit_attempt(db, quiz_id, user.id, data)


@quizzes_router.get("/{quiz_id}/attempts", response_model=list[QuizAttemptResponse])
async def list_attempts(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _load_quiz_with_membership(quiz_id, db, user, min_role=MemberRole.VIEWER)
    return await quiz_service.list_attempts_for_user(db, quiz_id, user.id)
