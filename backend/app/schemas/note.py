import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteBase(BaseModel):
    title: str


class NoteCreate(NoteBase):
    content: dict | None = None


class NoteUpdate(BaseModel):
    title: str | None = None
    content: dict | None = None


class NoteSummary(NoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    notebook_id: uuid.UUID
    sort_order: int
    version: int
    created_at: datetime
    updated_at: datetime


class NoteResponse(NoteSummary):
    content: dict | None = None
    content_text: str | None = None


class NoteVersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    note_id: uuid.UUID
    version_number: int
    edited_by: uuid.UUID
    created_at: datetime


class NoteVersionResponse(NoteVersionSummary):
    content: dict | None = None
    content_text: str | None = None
