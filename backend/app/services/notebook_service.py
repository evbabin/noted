import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notebook import Notebook
from app.schemas.notebook import NotebookCreate, NotebookUpdate
from app.exceptions import NotFoundError


async def create_notebook(
    db: AsyncSession, workspace_id: uuid.UUID, data: NotebookCreate
) -> Notebook:
    result = await db.execute(
        select(Notebook.sort_order)
        .where(Notebook.workspace_id == workspace_id)
        .order_by(Notebook.sort_order.desc())
        .limit(1)
    )
    max_order = result.scalar_one_or_none()
    new_order = 0 if max_order is None else max_order + 1

    notebook = Notebook(
        workspace_id=workspace_id, title=data.title, sort_order=new_order
    )
    db.add(notebook)
    # Flush (not commit) so get_db's request-scoped transaction stays the single
    # boundary; refresh picks up server-side defaults (id, created_at).
    await db.flush()
    await db.refresh(notebook)
    return notebook


async def get_notebooks(db: AsyncSession, workspace_id: uuid.UUID) -> list[Notebook]:
    result = await db.execute(
        select(Notebook)
        .where(Notebook.workspace_id == workspace_id)
        .order_by(Notebook.sort_order)
    )
    return list(result.scalars().all())


async def get_notebook(db: AsyncSession, notebook_id: uuid.UUID) -> Notebook:
    notebook = await db.get(Notebook, notebook_id)
    if not notebook:
        raise NotFoundError("Notebook not found")
    return notebook


async def update_notebook(
    db: AsyncSession, notebook_id: uuid.UUID, data: NotebookUpdate
) -> Notebook:
    notebook = await get_notebook(db, notebook_id)
    if data.title is not None:
        notebook.title = data.title
    await db.flush()
    await db.refresh(notebook)
    return notebook


async def delete_notebook(db: AsyncSession, notebook_id: uuid.UUID) -> None:
    notebook = await get_notebook(db, notebook_id)
    await db.delete(notebook)
    await db.flush()


async def reorder_notebooks(
    db: AsyncSession, workspace_id: uuid.UUID, ordered_ids: list[uuid.UUID]
) -> None:
    result = await db.execute(
        select(Notebook.id).where(Notebook.workspace_id == workspace_id)
    )
    existing_ids = {row for row in result.scalars().all()}
    if not set(ordered_ids).issubset(existing_ids):
        raise ValueError("Invalid notebook IDs")

    for index, nb_id in enumerate(ordered_ids):
        await db.execute(
            update(Notebook).where(Notebook.id == nb_id).values(sort_order=index)
        )
    await db.flush()
