import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    get_db,
    require_min_notebook_role,
    require_min_role,
)
from app.models.workspace_member import MemberRole
from app.schemas.notebook import (
    NotebookCreate,
    NotebookReorder,
    NotebookResponse,
    NotebookUpdate,
)
from app.services import notebook_service

workspace_notebooks_router = APIRouter(
    prefix="/workspaces/{workspace_id}/notebooks",
    tags=["notebooks"],
)


@workspace_notebooks_router.post(
    "",
    response_model=NotebookResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_notebook(
    workspace_id: uuid.UUID,
    data: NotebookCreate,
    db: AsyncSession = Depends(get_db),
    membership=Depends(require_min_role(MemberRole.EDITOR)),
):
    return await notebook_service.create_notebook(db, workspace_id, data)


@workspace_notebooks_router.get("", response_model=list[NotebookResponse])
async def list_notebooks(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    membership=Depends(require_min_role(MemberRole.VIEWER)),
):
    return await notebook_service.get_notebooks(db, workspace_id)


@workspace_notebooks_router.post("/reorder", status_code=status.HTTP_200_OK)
async def reorder_notebooks(
    workspace_id: uuid.UUID,
    data: NotebookReorder,
    db: AsyncSession = Depends(get_db),
    membership=Depends(require_min_role(MemberRole.EDITOR)),
):
    await notebook_service.reorder_notebooks(db, workspace_id, data.ordered_ids)
    return {"status": "ok"}


notebooks_router = APIRouter(prefix="/notebooks", tags=["notebooks"])


@notebooks_router.patch("/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(
    notebook_id: uuid.UUID,
    data: NotebookUpdate,
    db: AsyncSession = Depends(get_db),
    notebook=Depends(require_min_notebook_role(MemberRole.EDITOR)),
):
    return await notebook_service.update_notebook(db, notebook_id, data)


@notebooks_router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notebook(
    notebook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    notebook=Depends(require_min_notebook_role(MemberRole.EDITOR)),
):
    await notebook_service.delete_notebook(db, notebook_id)
