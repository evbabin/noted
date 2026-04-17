import hashlib
import logging
import uuid

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.redis import get_redis
from app.schemas.search import SearchHit, SearchResponse

logger = logging.getLogger(__name__)

SEARCH_CACHE_PREFIX = "search:"
SEARCH_CACHE_TTL_SECONDS = 60


# Scoped to a single workspace via the notebook join. `plainto_tsquery` handles
# user input safely (no manual escaping); ts_headline wraps hits in <mark> tags.
_SEARCH_SQL = text(
    """
    SELECT
        n.id AS note_id,
        n.notebook_id,
        n.title,
        ts_rank(n.search_vector, query) AS rank,
        ts_headline(
            'english',
            coalesce(n.content_text, n.title),
            query,
            'StartSel=<mark>,StopSel=</mark>,MaxWords=25,MinWords=10,ShortWord=3'
        ) AS snippet,
        count(*) OVER () AS total
    FROM notes n
    JOIN notebooks nb ON nb.id = n.notebook_id
    CROSS JOIN plainto_tsquery('english', :query) AS query
    WHERE nb.workspace_id = :workspace_id
      AND n.search_vector @@ query
    ORDER BY rank DESC, n.updated_at DESC
    LIMIT :limit OFFSET :offset
    """
).bindparams(
    bindparam("workspace_id"),
    bindparam("query"),
    bindparam("limit"),
    bindparam("offset"),
)


def _cache_key(workspace_id: uuid.UUID, query: str, limit: int, offset: int) -> str:
    digest = hashlib.sha256(f"{query}|{limit}|{offset}".encode("utf-8")).hexdigest()[
        :16
    ]
    return f"{SEARCH_CACHE_PREFIX}{workspace_id}:{digest}"


async def _read_cache(key: str) -> SearchResponse | None:
    try:
        redis = get_redis()
        raw = await redis.get(key)
    except Exception:
        logger.exception("Search cache read failed; bypassing cache")
        return None
    if raw is None:
        return None
    try:
        return SearchResponse.model_validate_json(raw)
    except Exception:
        logger.warning("Invalid cached search payload at %s", key)
        return None


async def _write_cache(key: str, response: SearchResponse) -> None:
    try:
        redis = get_redis()
        await redis.setex(key, SEARCH_CACHE_TTL_SECONDS, response.model_dump_json())
    except Exception:
        logger.exception("Search cache write failed; ignoring")


async def search_workspace(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    query: str,
    limit: int,
    offset: int,
) -> SearchResponse:
    query = query.strip()
    if not query:
        return SearchResponse(results=[], total=0, query=query)

    cache_key = _cache_key(workspace_id, query, limit, offset)
    cached = await _read_cache(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(
        _SEARCH_SQL,
        {
            "workspace_id": workspace_id,
            "query": query,
            "limit": limit,
            "offset": offset,
        },
    )
    rows = result.mappings().all()

    total = int(rows[0]["total"]) if rows else 0
    hits = [
        SearchHit(
            note_id=row["note_id"],
            notebook_id=row["notebook_id"],
            title=row["title"],
            snippet=row["snippet"],
            rank=float(row["rank"]),
        )
        for row in rows
    ]
    response = SearchResponse(results=hits, total=total, query=query)
    await _write_cache(cache_key, response)
    return response
