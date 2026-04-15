import uuid

from pydantic import BaseModel


class SearchHit(BaseModel):
    note_id: uuid.UUID
    notebook_id: uuid.UUID
    title: str
    snippet: str
    rank: float


class SearchResponse(BaseModel):
    results: list[SearchHit]
    total: int
    query: str
