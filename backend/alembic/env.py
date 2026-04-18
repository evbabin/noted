import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import all models so Alembic can detect them
from app.models.base import Base  # noqa: F401
from app.models import (  # noqa: F401
    user,
    workspace,
    workspace_member,
    notebook,
    note,
    note_version,
    quiz,
    quiz_question,
    quiz_attempt,
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# alembic.ini intentionally leaves sqlalchemy.url blank — we require DATABASE_URL from
# the environment so the same alembic invocation works in local dev, CI, and k8s pods
# without editing the ini. Fail loudly rather than silently connecting to a localhost
# default if it's missing.
_db_url = os.environ.get("DATABASE_URL")
if not _db_url:
    raise RuntimeError(
        "DATABASE_URL is not set — alembic cannot run without it. "
        "Set it in your shell, .env, or the pod's envFrom Secret."
    )
config.set_main_option("sqlalchemy.url", _db_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
