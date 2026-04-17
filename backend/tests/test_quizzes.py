import asyncio
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.middleware import rate_limit as rate_limit_module
from app.models.note import Note
from app.models.quiz import QuestionType, Quiz, QuizStatus
from app.models.quiz_question import QuizQuestion
from app.routers import quizzes as quizzes_router_module
from app.schemas.quiz import QuizCreate
from app.services import ai_service, quiz_service
from app.tasks import quiz_tasks

pytestmark = pytest.mark.asyncio


def _doc_with_text(text: str) -> dict:
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text}],
            }
        ],
    }


class FakeArqPool:
    """Collect enqueued jobs so route tests can assert background work setup."""

    def __init__(self) -> None:
        self.calls: list[tuple[tuple, dict]] = []

    async def enqueue_job(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return {"job_id": "fake-job"}


@pytest.fixture
def patched_rate_limit_counter(monkeypatch: pytest.MonkeyPatch):
    counts: dict[str, int] = {}

    async def _fake_incr_window(key: str, window_seconds: int) -> int:
        _ = window_seconds
        counts[key] = counts.get(key, 0) + 1
        return counts[key]

    monkeypatch.setattr(rate_limit_module, "_incr_window", _fake_incr_window)
    return counts


@pytest.fixture
def fake_arq_pool(monkeypatch: pytest.MonkeyPatch) -> FakeArqPool:
    pool = FakeArqPool()

    async def _get_pool() -> FakeArqPool:
        return pool

    monkeypatch.setattr(quizzes_router_module, "get_arq_pool", _get_pool)
    return pool


async def _create_authenticated_note(
    client: AsyncClient,
    *,
    email: str = "quiz@example.com",
    note_text: str = (
        "This note contains enough content for quiz generation tests and covers "
        "multiple facts about the same topic for scoring."
    ),
) -> tuple[dict[str, str], str, str]:
    register = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "correct-horse-battery",
            "display_name": "Quiz User",
        },
    )
    assert register.status_code == 201, register.text
    token = register.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    workspace = await client.post(
        "/api/v1/workspaces/",
        json={"name": "Quiz Workspace"},
        headers=headers,
    )
    assert workspace.status_code == 201, workspace.text
    workspace_id = workspace.json()["id"]

    notebook = await client.post(
        f"/api/v1/workspaces/{workspace_id}/notebooks",
        json={"title": "Quiz Notebook"},
        headers=headers,
    )
    assert notebook.status_code == 201, notebook.text
    notebook_id = notebook.json()["id"]

    note = await client.post(
        f"/api/v1/notebooks/{notebook_id}/notes",
        json={"title": "Quiz Note", "content": _doc_with_text(note_text)},
        headers=headers,
    )
    assert note.status_code == 201, note.text

    return headers, note.json()["id"], note_text


async def test_generate_quiz_returns_202(
    client: AsyncClient,
    fake_arq_pool: FakeArqPool,
    patched_rate_limit_counter,
):
    headers, note_id, note_text = await _create_authenticated_note(client)

    response = await client.post(
        f"/api/v1/notes/{note_id}/quizzes",
        json={"title": "Chapter 1 Review", "num_questions": 8},
        headers=headers,
    )

    assert response.status_code == 202, response.text
    body = response.json()
    assert body["note_id"] == note_id
    assert body["title"] == "Chapter 1 Review"
    assert body["status"] == "pending"

    assert len(fake_arq_pool.calls) == 1
    args, kwargs = fake_arq_pool.calls[0]
    assert args[0] == "generate_quiz_task"
    assert args[2] == note_text
    assert args[3] == 8
    assert kwargs["_queue_name"] == "noted:jobs"

    get_response = await client.get(f"/api/v1/quizzes/{body['id']}", headers=headers)
    assert get_response.status_code == 200, get_response.text
    assert get_response.json()["status"] == "pending"
    assert get_response.json()["questions"] == []


async def test_quiz_status_transitions(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers, note_id, note_text = await _create_authenticated_note(
        client,
        email="quiz-status@example.com",
    )
    note = await db_session.get(Note, uuid.UUID(note_id))
    assert note is not None

    quiz = await quiz_service.create_quiz(
        db_session,
        note,
        QuizCreate(title="Status Quiz", num_questions=3),
        FakeArqPool(),
    )
    assert quiz.status == QuizStatus.PENDING
    quiz_id = str(quiz.id)

    # The worker opens its own AsyncSessionLocal, so point it at the pytest DB.
    session_factory = async_sessionmaker(
        db_session.bind, class_=AsyncSession, expire_on_commit=False
    )
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(quiz_tasks, "AsyncSessionLocal", session_factory)

    started = asyncio.Event()
    release = asyncio.Event()

    class FakeProvider:
        async def generate_quiz_from_content(
            self, content: str, num_questions: int = 10
        ):
            assert content == note_text
            assert num_questions == 3
            started.set()
            await release.wait()
            return [
                {
                    "question_type": "multiple_choice",
                    "question_text": "What is the main topic?",
                    "options": {"choices": ["Tests", "Birds", "Cars", "Rivers"]},
                    "correct_answer": "Tests",
                    "explanation": "The note is explicitly about quiz generation tests.",
                },
                {
                    "question_type": "fill_in_the_blank",
                    "question_text": "Quiz generation uses ___ workers.",
                    "options": None,
                    "correct_answer": "ARQ",
                    "explanation": "The backend queues generation work in ARQ.",
                },
                {
                    "question_type": "flashcard",
                    "question_text": "Name the persistence store used for rate limits.",
                    "options": None,
                    "correct_answer": "Redis",
                    "explanation": "Rate limits are stored in Redis.",
                },
            ]

    monkeypatch.setattr(ai_service, "get_ai_provider", lambda: FakeProvider())

    try:
        worker_task = asyncio.create_task(
            quiz_tasks.generate_quiz_task({}, str(quiz.id), note_text, 3)
        )
        await asyncio.wait_for(started.wait(), timeout=2)

        async with session_factory() as inspector:
            generating_quiz = await inspector.get(Quiz, quiz.id)
            assert generating_quiz is not None
            assert generating_quiz.status == QuizStatus.GENERATING

        release.set()
        result = await worker_task
    finally:
        monkeypatch.undo()

    assert result["status"] == QuizStatus.COMPLETED.value
    assert result["question_count"] == 3

    async with session_factory() as inspector:
        completed_quiz = await quiz_service.get_quiz(inspector, quiz.id)
        assert completed_quiz.status == QuizStatus.COMPLETED
        assert [question.order for question in completed_quiz.questions] == [0, 1, 2]
        assert len(completed_quiz.questions) == 3

    db_session.expire_all()
    quiz_response = await client.get(f"/api/v1/quizzes/{quiz_id}", headers=headers)
    assert quiz_response.status_code == 200, quiz_response.text
    assert quiz_response.json()["status"] == "completed"
    assert len(quiz_response.json()["questions"]) == 3


async def test_submit_quiz_attempt_calculates_score(
    client: AsyncClient, db_session: AsyncSession
):
    headers, note_id, _note_text = await _create_authenticated_note(
        client,
        email="quiz-attempt@example.com",
    )

    quiz = Quiz(
        note_id=uuid.UUID(note_id),
        title="Attempt Quiz",
        status=QuizStatus.COMPLETED,
    )
    db_session.add(quiz)
    await db_session.flush()

    questions = [
        QuizQuestion(
            quiz_id=quiz.id,
            question_type=QuestionType.MULTIPLE_CHOICE,
            question_text="What queue backs background jobs?",
            options={"choices": ["ARQ", "RQ", "Celery", "Huey"]},
            correct_answer="ARQ",
            explanation="The worker is configured with ARQ.",
            order=0,
        ),
        QuizQuestion(
            quiz_id=quiz.id,
            question_type=QuestionType.FILL_IN_THE_BLANK,
            question_text="Refresh tokens are stored in ___.",
            options=None,
            correct_answer="Redis",
            explanation="Refresh tokens are hashed and stored in Redis.",
            order=1,
        ),
        QuizQuestion(
            quiz_id=quiz.id,
            question_type=QuestionType.FLASHCARD,
            question_text="Name the frontend server-state library.",
            options=None,
            correct_answer="React Query",
            explanation="The SPA uses React Query for server state.",
            order=2,
        ),
    ]
    db_session.add_all(questions)
    await db_session.commit()

    attempt_response = await client.post(
        f"/api/v1/quizzes/{quiz.id}/attempts",
        json={
            "answers": {
                str(questions[0].id): "ARQ",
                str(questions[1].id): " redis ",
                str(questions[2].id): "Zustand",
            }
        },
        headers=headers,
    )

    assert attempt_response.status_code == 201, attempt_response.text
    body = attempt_response.json()
    assert body["correct_count"] == 2
    assert body["total_questions"] == 3
    assert body["score"] == pytest.approx(66.67, abs=0.01)
    assert body["answers"][str(questions[0].id)] == {"answer": "ARQ", "correct": True}
    assert body["answers"][str(questions[1].id)] == {
        "answer": " redis ",
        "correct": True,
    }
    assert body["answers"][str(questions[2].id)] == {
        "answer": "Zustand",
        "correct": False,
    }

    list_response = await client.get(
        f"/api/v1/quizzes/{quiz.id}/attempts", headers=headers
    )
    assert list_response.status_code == 200, list_response.text
    attempts = list_response.json()
    assert len(attempts) == 1
    assert attempts[0]["id"] == body["id"]


async def test_submit_quiz_attempt_accepts_flashcard_self_assessment(
    client: AsyncClient,
    db_session: AsyncSession,
):
    headers, note_id, _note_text = await _create_authenticated_note(
        client,
        email="quiz-flashcard@example.com",
    )

    quiz = Quiz(
        note_id=uuid.UUID(note_id),
        title="Flashcard Quiz",
        status=QuizStatus.COMPLETED,
    )
    db_session.add(quiz)
    await db_session.flush()

    question = QuizQuestion(
        quiz_id=quiz.id,
        question_type=QuestionType.FLASHCARD,
        question_text="Which library manages server state on the frontend?",
        options=None,
        correct_answer="React Query",
        explanation="The SPA uses React Query for server state.",
        order=0,
    )
    db_session.add(question)
    await db_session.commit()

    attempt_response = await client.post(
        f"/api/v1/quizzes/{quiz.id}/attempts",
        json={"answers": {str(question.id): "correct"}},
        headers=headers,
    )

    assert attempt_response.status_code == 201, attempt_response.text
    body = attempt_response.json()
    assert body["correct_count"] == 1
    assert body["total_questions"] == 1
    assert body["score"] == 100
    assert body["answers"][str(question.id)] == {
        "answer": "correct",
        "correct": True,
    }


async def test_rate_limit_on_generation(
    client: AsyncClient,
    fake_arq_pool: FakeArqPool,
    patched_rate_limit_counter,
):
    headers, note_id, _note_text = await _create_authenticated_note(
        client,
        email="quiz-rate-limit@example.com",
    )

    for index in range(5):
        response = await client.post(
            f"/api/v1/notes/{note_id}/quizzes",
            json={"title": f"Rate Limit Quiz {index}", "num_questions": 3},
            headers=headers,
        )
        assert response.status_code == 202, response.text

    limited = await client.post(
        f"/api/v1/notes/{note_id}/quizzes",
        json={"title": "Rate Limit Quiz 6", "num_questions": 3},
        headers=headers,
    )

    assert limited.status_code == 429, limited.text
    assert "Rate limit exceeded" in limited.json()["detail"]
    assert len(fake_arq_pool.calls) == 5
