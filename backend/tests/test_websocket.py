from __future__ import annotations

import asyncio
import importlib
import os
import uuid
from collections.abc import AsyncIterator, Iterator
from typing import Any

import app.database as database_module
import app.main as app_main
import app.websocket.handlers as websocket_handlers
import app.websocket.router as websocket_router
import pytest
from app.models import (  # noqa: F401 - Ensure all models are registered on Base.metadata.
    note,
    note_version,
    notebook,
    quiz,
    quiz_attempt,
    quiz_question,
    user,
    workspace,
    workspace_member,
)
from app.models.base import Base
from app.models.note import Note
from app.models.note_version import NoteVersion
from app.models.notebook import Notebook
from app.models.user import User
from app.models.workspace import Workspace
from app.models.workspace_member import MemberRole, WorkspaceMember
from app.services import auth_service
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

websocket_manager_module = importlib.import_module("app.websocket.manager")

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://noted:noted@localhost:5432/noted_test",
)


def _empty_doc() -> dict[str, Any]:
    """Return the canonical empty editor document used in collaboration tests."""
    return {"type": "doc", "content": []}


def _paragraph_doc(block_id: str, text_content: str) -> dict[str, Any]:
    """Build a TipTap/ProseMirror paragraph node with a stable collaboration block id."""
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "attrs": {
                    "block_id": block_id,
                    "id": block_id,
                },
                "content": [
                    {
                        "type": "text",
                        "text": text_content,
                    }
                ],
            }
        ],
    }


class RecordingWebSocket:
    """Minimal websocket double that records outbound messages for unit tests."""

    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    async def send_json(self, message: dict[str, Any]) -> None:
        self.messages.append(message)


class RecordingManager:
    """Connection manager stand-in that records broadcasts without network side effects."""

    def __init__(self) -> None:
        self.broadcast_calls: list[dict[str, Any]] = []

    async def broadcast(
        self,
        note_id: uuid.UUID | str,
        message: dict[str, Any],
        exclude_user: uuid.UUID | str | None = None,
        *,
        publish: bool = True,
    ) -> None:
        self.broadcast_calls.append(
            {
                "note_id": str(note_id),
                "message": message,
                "exclude_user": str(exclude_user) if exclude_user is not None else None,
                "publish": publish,
            }
        )


async def _reset_collaboration_state() -> None:
    """Clear singleton collaboration state between tests.

    The collaboration stack keeps process-global room state, pending debounce tasks,
    and in-memory draft caches. Each test must start from a clean slate so failures
    do not depend on execution order.
    """
    await websocket_manager_module.manager.stop_pubsub()
    websocket_manager_module.manager.active_connections.clear()

    for task in list(websocket_handlers._flush_tasks.values()):
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    async with websocket_handlers._flush_task_lock:
        websocket_handlers._flush_tasks.clear()

    async with websocket_handlers._local_draft_lock:
        websocket_handlers._local_drafts.clear()


@pytest.fixture(autouse=True)
def reset_collaboration_state() -> Iterator[None]:
    asyncio.run(_reset_collaboration_state())
    yield
    asyncio.run(_reset_collaboration_state())


@pytest.fixture
def websocket_client(
    fake_redis,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, async_sessionmaker[AsyncSession]]]:
    """Provide a `TestClient` whose websocket stack uses the test DB and fake Redis.

    The websocket router bypasses the normal HTTP dependency override path and opens
    sessions from imported module-level factories. Patch those factories before app
    creation so websocket auth, room sync, and disconnect persistence all point at
    the same isolated test database.
    """

    async def _create_factory() -> tuple[async_sessionmaker[AsyncSession], Any]:
        engine = create_async_engine(
            TEST_DATABASE_URL,
            poolclass=NullPool,
        )

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(
                text(
                    "ALTER TABLE notes ADD COLUMN IF NOT EXISTS search_vector tsvector "
                    "GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') "
                    "|| setweight(to_tsvector('english', coalesce(content_text, '')), 'B')) STORED;"
                )
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_notes_search "
                    "ON notes USING GIN(search_vector);"
                )
            )

        factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        return factory, engine

    websocket_session_factory, engine = asyncio.run(_create_factory())

    monkeypatch.setattr(database_module, "AsyncSessionLocal", websocket_session_factory)
    monkeypatch.setattr(
        websocket_router, "AsyncSessionLocal", websocket_session_factory
    )
    monkeypatch.setattr(
        websocket_handlers, "AsyncSessionLocal", websocket_session_factory
    )

    app = app_main.create_app()
    try:
        with TestClient(app) as client:
            yield client, websocket_session_factory
    finally:

        async def _dispose() -> None:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
            await engine.dispose()

        asyncio.run(_dispose())


async def _create_collaboration_context(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    owner_email: str = "owner@example.com",
    owner_name: str = "Owner",
    member_email: str = "member@example.com",
    member_name: str = "Member",
) -> dict[str, Any]:
    """Create two users sharing one note and return auth tokens plus entity IDs."""
    async with session_factory() as db:
        owner = User(
            email=owner_email,
            display_name=owner_name,
            hashed_password=auth_service.hash_password("correct-horse-battery"),
            is_active=True,
            is_verified=True,
        )
        member = User(
            email=member_email,
            display_name=member_name,
            hashed_password=auth_service.hash_password("correct-horse-battery"),
            is_active=True,
            is_verified=True,
        )

        db.add_all([owner, member])
        await db.flush()

        ws = Workspace(
            name="Collaboration Workspace",
            owner_id=owner.id,
        )
        db.add(ws)
        await db.flush()

        db.add_all(
            [
                WorkspaceMember(
                    workspace_id=ws.id,
                    user_id=owner.id,
                    role=MemberRole.OWNER,
                ),
                WorkspaceMember(
                    workspace_id=ws.id,
                    user_id=member.id,
                    role=MemberRole.EDITOR,
                ),
            ]
        )

        nb = Notebook(
            title="Shared Notebook",
            workspace_id=ws.id,
        )
        db.add(nb)
        await db.flush()

        shared_note = Note(
            title="Shared Note",
            content=_empty_doc(),
            content_text=None,
            notebook_id=nb.id,
            sort_order=0,
            version=1,
        )
        db.add(shared_note)
        await db.flush()

        db.add(
            NoteVersion(
                note_id=shared_note.id,
                version_number=1,
                content=shared_note.content,
                content_text=shared_note.content_text,
                edited_by=owner.id,
            )
        )

        await db.commit()
        await db.refresh(owner)
        await db.refresh(member)
        await db.refresh(shared_note)

        owner_access = auth_service.create_access_token(owner.id, owner.email)
        member_access = auth_service.create_access_token(member.id, member.email)

        return {
            "workspace_id": ws.id,
            "notebook_id": nb.id,
            "note_id": shared_note.id,
            "owner": owner,
            "member": member,
            "owner_token": owner_access,
            "member_token": member_access,
        }


async def _fetch_note_state(
    session_factory: async_sessionmaker[AsyncSession],
    note_id: uuid.UUID,
) -> tuple[Note, list[NoteVersion]]:
    """Load the persisted note plus its version history for persistence assertions."""
    async with session_factory() as db:
        note_obj = await db.get(Note, note_id)
        assert note_obj is not None

        result = await db.execute(
            select(NoteVersion)
            .where(NoteVersion.note_id == note_id)
            .order_by(NoteVersion.version_number.desc())
        )
        versions = list(result.scalars().all())
        return note_obj, versions


@pytest.mark.asyncio
async def test_handle_client_message_rejects_invalid_json(
    db_session: AsyncSession,
) -> None:
    """Malformed websocket payloads should return a structured protocol error."""
    owner = User(
        email="invalid-json@example.com",
        display_name="Invalid JSON User",
        hashed_password=auth_service.hash_password("correct-horse-battery"),
        is_active=True,
        is_verified=True,
    )
    ws = Workspace(
        name="Invalid JSON Workspace",
        owner_id=owner.id,
    )

    db_session.add(owner)
    await db_session.flush()

    ws.owner_id = owner.id
    db_session.add(ws)
    await db_session.flush()

    db_session.add(
        WorkspaceMember(
            workspace_id=ws.id,
            user_id=owner.id,
            role=MemberRole.OWNER,
        )
    )

    nb = Notebook(title="Notebook", workspace_id=ws.id)
    db_session.add(nb)
    await db_session.flush()

    note_obj = Note(
        title="Note",
        content=_empty_doc(),
        content_text=None,
        notebook_id=nb.id,
        version=1,
        sort_order=0,
    )
    db_session.add(note_obj)
    await db_session.flush()

    websocket = RecordingWebSocket()
    manager = RecordingManager()

    await websocket_handlers.handle_client_message(
        manager=manager,
        websocket=websocket,
        note=note_obj,
        user=owner,
        payload="{not valid json",
    )

    assert websocket.messages == [
        {
            "type": "error",
            "data": {
                "code": "invalid_json",
                "message": "Malformed JSON payload",
            },
        }
    ]
    assert manager.broadcast_calls == []


@pytest.mark.asyncio
async def test_connection_manager_pubsub_forwards_remote_messages(
    fake_redis,
) -> None:
    """Redis pub/sub fan-out should forward remote instance messages once per room."""
    note_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    class LocalSocket:
        def __init__(self) -> None:
            self.sent: list[dict[str, Any]] = []
            self.accepted = False

        async def accept(self) -> None:
            self.accepted = True

        async def send_json(self, message: dict[str, Any]) -> None:
            self.sent.append(message)

    manager = websocket_manager_module.ConnectionManager()
    socket = LocalSocket()

    await manager.start_pubsub()
    await manager.connect(note_id, user_id, socket)

    remote_payload = {
        "origin": "different-instance",
        "note_id": note_id,
        "exclude_user": None,
        "message": {
            "type": "cursor_update",
            "data": {
                "user_id": "remote-user",
                "position": 7,
                "selection": None,
            },
        },
    }

    await fake_redis.publish(
        manager.channel_name(note_id), __import__("json").dumps(remote_payload)
    )
    await asyncio.sleep(0.2)

    assert socket.accepted is True
    assert socket.sent == [remote_payload["message"]]

    await manager.disconnect(note_id, user_id)
    await manager.stop_pubsub()


def test_websocket_requires_access_token(
    websocket_client: tuple[TestClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Connections without a JWT should be rejected with a structured auth error."""
    client, session_factory = websocket_client
    context = asyncio.run(
        _create_collaboration_context(
            session_factory,
            owner_email="missing-token-owner@example.com",
            member_email="missing-token-member@example.com",
        )
    )
    note_id = context["note_id"]

    with client.websocket_connect(f"/api/v1/ws/{note_id}") as websocket:
        assert websocket.receive_json() == {
            "type": "error",
            "data": {
                "code": "missing_token",
                "message": "Missing access token",
            },
        }


def test_websocket_rejects_non_member_user(
    websocket_client: tuple[TestClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Workspace membership is required before a user may join a collaboration room."""
    client, session_factory = websocket_client
    context = asyncio.run(
        _create_collaboration_context(
            session_factory,
            owner_email="member-guard-owner@example.com",
            member_email="member-guard-editor@example.com",
        )
    )

    async def _create_outsider_token() -> str:
        async with session_factory() as db:
            outsider = User(
                email="outsider@example.com",
                display_name="Outsider",
                hashed_password=auth_service.hash_password("correct-horse-battery"),
                is_active=True,
                is_verified=True,
            )
            db.add(outsider)
            await db.flush()
            await db.commit()
            return auth_service.create_access_token(outsider.id, outsider.email)

    outsider_token = asyncio.run(_create_outsider_token())

    with client.websocket_connect(
        f"/api/v1/ws/{context['note_id']}?token={outsider_token}"
    ) as websocket:
        payload = websocket.receive_json()
        assert payload["type"] == "error"
        assert payload["data"]["code"] == "authentication_failed"
        assert payload["data"]["message"] == "Note not found"


def test_websocket_connect_returns_sync_state(
    websocket_client: tuple[TestClient, async_sessionmaker[AsyncSession]],
) -> None:
    """A valid collaborator should receive the live note snapshot on connect."""
    client, session_factory = websocket_client
    context = asyncio.run(
        _create_collaboration_context(
            session_factory,
            owner_email="alice@example.com",
            owner_name="Alice",
            member_email="bob@example.com",
            member_name="Bob",
        )
    )
    note_id = context["note_id"]
    owner_id = str(context["owner"].id)

    with client.websocket_connect(
        f"/api/v1/ws/{note_id}?token={context['owner_token']}"
    ) as websocket:
        payload = websocket.receive_json()
        assert payload["type"] == "sync_state"
        assert payload["data"]["content"] == _empty_doc()
        assert payload["data"]["version"] == 1
        assert {user["user_id"] for user in payload["data"]["users"]} == {owner_id}


@pytest.mark.asyncio
async def test_handle_content_update_stages_broadcasts_and_persists_note_version(
    fake_redis,
    monkeypatch: pytest.MonkeyPatch,
    db_session: AsyncSession,
) -> None:
    """Content updates should stage a draft, broadcast it, and persist on flush."""
    owner = User(
        email="persist-owner@example.com",
        display_name="Persist Owner",
        hashed_password=auth_service.hash_password("correct-horse-battery"),
        is_active=True,
        is_verified=True,
    )
    db_session.add(owner)
    await db_session.flush()

    workspace = Workspace(
        name="Persistence Workspace",
        owner_id=owner.id,
    )
    db_session.add(workspace)
    await db_session.flush()

    db_session.add(
        WorkspaceMember(
            workspace_id=workspace.id,
            user_id=owner.id,
            role=MemberRole.OWNER,
        )
    )

    notebook_obj = Notebook(
        title="Persistence Notebook",
        workspace_id=workspace.id,
    )
    db_session.add(notebook_obj)
    await db_session.flush()

    note_obj = Note(
        title="Persistence Note",
        content=_empty_doc(),
        content_text=None,
        notebook_id=notebook_obj.id,
        version=1,
        sort_order=0,
    )
    db_session.add(note_obj)
    await db_session.flush()

    db_session.add(
        NoteVersion(
            note_id=note_obj.id,
            version_number=1,
            content=note_obj.content,
            content_text=note_obj.content_text,
            edited_by=owner.id,
        )
    )
    await db_session.commit()

    session_factory = async_sessionmaker(
        bind=db_session.bind,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    monkeypatch.setattr(websocket_handlers, "AsyncSessionLocal", session_factory)

    manager = RecordingManager()
    data = websocket_handlers.ContentUpdateData.model_validate(
        {
            "blocks": [
                {
                    "block_id": "block-1",
                    "action": "insert",
                    "position": 0,
                    "content": {
                        "type": "paragraph",
                        "content": [
                            {
                                "type": "text",
                                "text": "Hello from persistence",
                            }
                        ],
                    },
                }
            ]
        }
    )

    version = await websocket_handlers.handle_content_update(
        manager=manager,
        note=note_obj,
        user=owner,
        data=data,
    )

    assert version == 2
    assert manager.broadcast_calls == [
        {
            "note_id": str(note_obj.id),
            "message": {
                "type": "content_update",
                "data": {
                    "blocks": [
                        {
                            "block_id": "block-1",
                            "action": "insert",
                            "content": {
                                "type": "paragraph",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": "Hello from persistence",
                                    }
                                ],
                            },
                            "position": 0,
                        }
                    ],
                    "user_id": str(owner.id),
                    "version": 2,
                },
            },
            "exclude_user": str(owner.id),
            "publish": True,
        }
    ]

    draft = await websocket_handlers.load_draft_state(note_obj.id)
    assert draft is not None
    assert draft["version"] == 2
    assert draft["content"] == _paragraph_doc("block-1", "Hello from persistence")

    await websocket_handlers.flush_note_on_disconnect(note_obj.id)

    persisted_note, versions = await _fetch_note_state(session_factory, note_obj.id)
    assert persisted_note.version == 2
    assert persisted_note.content == _paragraph_doc("block-1", "Hello from persistence")
    assert persisted_note.content_text == "Hello from persistence"

    assert [item.version_number for item in versions] == [2, 1]
    assert versions[0].edited_by == owner.id
    assert versions[0].content == _paragraph_doc("block-1", "Hello from persistence")
    assert versions[0].content_text == "Hello from persistence"
