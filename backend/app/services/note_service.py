import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
from app.models.note import Note
from app.models.note_version import NoteVersion
from app.schemas.note import NoteCreate, NoteUpdate


def _snapshot(note: Note, edited_by: uuid.UUID) -> NoteVersion:
    return NoteVersion(
        note_id=note.id,
        version_number=note.version,
        content=note.content,
        content_text=note.content_text,
        edited_by=edited_by,
    )


def extract_plain_text(content: Any) -> str | None:
    """Walk a TipTap/ProseMirror JSON doc and concatenate text nodes."""
    if not content:
        return None
    parts: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "text":
                text = node.get("text")
                if isinstance(text, str):
                    parts.append(text)
            for child in node.get("content", []) or []:
                walk(child)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(content)
    text = " ".join(p for p in parts if p)
    return text or None


async def persist_collaborative_note(
    db: AsyncSession,
    note_id: uuid.UUID,
    user_id: uuid.UUID,
    content: dict | None,
    version: int,
) -> Note:
    note = await get_note(db, note_id)

    note.content = content
    note.content_text = extract_plain_text(content)
    note.version = version

    result = await db.execute(
        select(NoteVersion).where(
            NoteVersion.note_id == note_id,
            NoteVersion.version_number == version,
        )
    )
    existing_version = result.scalar_one_or_none()

    if existing_version is None:
        db.add(_snapshot(note, user_id))
    else:
        existing_version.content = note.content
        existing_version.content_text = note.content_text
        existing_version.edited_by = user_id

    await db.flush()
    await db.refresh(note)
    return note


async def create_note(
    db: AsyncSession,
    notebook_id: uuid.UUID,
    user_id: uuid.UUID,
    data: NoteCreate,
) -> Note:
    result = await db.execute(
        select(Note.sort_order)
        .where(Note.notebook_id == notebook_id)
        .order_by(Note.sort_order.desc())
        .limit(1)
    )
    max_order = result.scalar_one_or_none()
    new_order = 0 if max_order is None else max_order + 1

    note = Note(
        notebook_id=notebook_id,
        title=data.title,
        content=data.content,
        content_text=extract_plain_text(data.content),
        sort_order=new_order,
        version=1,
    )
    db.add(note)
    await db.flush()
    db.add(_snapshot(note, user_id))
    await db.flush()
    await db.refresh(note)
    return note


async def list_notes(db: AsyncSession, notebook_id: uuid.UUID) -> list[Note]:
    result = await db.execute(
        select(Note).where(Note.notebook_id == notebook_id).order_by(Note.sort_order)
    )
    return list(result.scalars().all())


async def get_note(db: AsyncSession, note_id: uuid.UUID) -> Note:
    note = await db.get(Note, note_id)
    if note is None:
        raise NotFoundError("Note not found")
    return note


async def update_note(
    db: AsyncSession,
    note_id: uuid.UUID,
    user_id: uuid.UUID,
    data: NoteUpdate,
) -> Note:
    note = await get_note(db, note_id)

    content_changed = "content" in data.model_fields_set
    if data.title is not None:
        note.title = data.title
    if content_changed:
        note.content = data.content
        note.content_text = extract_plain_text(data.content)

    if content_changed or data.title is not None:
        note.version = (note.version or 0) + 1
        db.add(_snapshot(note, user_id))

    await db.flush()
    await db.refresh(note)
    return note


async def delete_note(db: AsyncSession, note_id: uuid.UUID) -> None:
    note = await get_note(db, note_id)
    await db.delete(note)
    await db.flush()


async def list_note_versions(db: AsyncSession, note_id: uuid.UUID) -> list[NoteVersion]:
    await get_note(db, note_id)
    result = await db.execute(
        select(NoteVersion)
        .where(NoteVersion.note_id == note_id)
        .order_by(NoteVersion.version_number.desc())
    )
    return list(result.scalars().all())


async def get_note_version(
    db: AsyncSession, note_id: uuid.UUID, version_number: int
) -> NoteVersion:
    await get_note(db, note_id)
    result = await db.execute(
        select(NoteVersion).where(
            NoteVersion.note_id == note_id,
            NoteVersion.version_number == version_number,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise NotFoundError("Note version not found")
    return version
