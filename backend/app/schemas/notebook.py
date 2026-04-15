from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class NotebookBase(BaseModel):
    title: str

class NotebookCreate(NotebookBase):
    pass

class NotebookUpdate(BaseModel):
    title: Optional[str] = None

class NotebookReorder(BaseModel):
    ordered_ids: list[UUID]

class NotebookResponse(NotebookBase):
    id: UUID
    workspace_id: UUID
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
