import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    get_current_user,
    get_db,
    require_min_note_role,
    require_min_notebook_role,
)
from app.models.user import User
from app.models.workspace_member import MemberRole
from app.schemas.note import (
    NoteCreate,
    NoteResponse,
    NoteSummary,
    NoteUpdate,
    NoteVersionResponse,
    NoteVersionSummary,
)
from app.services import note_service

notebook_notes_router = APIRouter(
    prefix="/notebooks/{notebook_id}/notes",
    tags=["notes"],
)


@notebook_notes_router.post(
    "",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_note(
    notebook_id: uuid.UUID,
    data: NoteCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    notebook=Depends(require_min_notebook_role(MemberRole.EDITOR)),
):
    return await note_service.create_note(db, notebook_id, user.id, data)


@notebook_notes_router.get("", response_model=list[NoteSummary])
async def list_notes(
    notebook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    notebook=Depends(require_min_notebook_role(MemberRole.VIEWER)),
):
    return await note_service.list_notes(db, notebook_id)


notes_router = APIRouter(prefix="/notes", tags=["notes"])


@notes_router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    note=Depends(require_min_note_role(MemberRole.VIEWER)),
):
    return await note_service.get_note(db, note_id)


@notes_router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: uuid.UUID,
    data: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    note=Depends(require_min_note_role(MemberRole.EDITOR)),
):
    return await note_service.update_note(db, note_id, user.id, data)


@notes_router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    note=Depends(require_min_note_role(MemberRole.EDITOR)),
):
    await note_service.delete_note(db, note_id)


@notes_router.get("/{note_id}/versions", response_model=list[NoteVersionSummary])
async def list_note_versions(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    note=Depends(require_min_note_role(MemberRole.VIEWER)),
):
    return await note_service.list_note_versions(db, note_id)


@notes_router.get(
    "/{note_id}/versions/{version_number}",
    response_model=NoteVersionResponse,
)
async def get_note_version(
    note_id: uuid.UUID,
    version_number: int,
    db: AsyncSession = Depends(get_db),
    note=Depends(require_min_note_role(MemberRole.VIEWER)),
):
    return await note_service.get_note_version(db, note_id, version_number)
