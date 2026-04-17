"""add notes search_vector + GIN index

Revision ID: a1b2c3d4e5f6
Revises: 41018ec717e2
Create Date: 2026-04-15 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "41018ec717e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE notes ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(content_text, '')), 'B')
        ) STORED;
        """
    )
    op.execute("CREATE INDEX idx_notes_search ON notes USING GIN(search_vector);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_notes_search;")
    op.execute("ALTER TABLE notes DROP COLUMN IF EXISTS search_vector;")
