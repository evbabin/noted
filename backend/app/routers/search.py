import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_min_role
from app.models.workspace_member import MemberRole
from app.schemas.search import SearchResponse
from app.services import search_service

router = APIRouter(prefix="/workspaces/{workspace_id}/search", tags=["search"])


@router.get("", response_model=SearchResponse)
async def search_workspace(
    workspace_id: uuid.UUID,
    q: str = Query(..., min_length=1, max_length=256),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    membership=Depends(require_min_role(MemberRole.VIEWER)),
) -> SearchResponse:
    return await search_service.search_workspace(db, workspace_id, q, limit, offset)
