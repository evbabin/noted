from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import uuid
from contextlib import asynccontextmanager
from copy import deepcopy
from typing import Any, Literal, TypedDict, cast

from fastapi import WebSocket
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.database import AsyncSessionLocal
from app.models.note import Note
from app.models.user import User
from app.redis import get_redis
from app.services import note_service
from app.websocket.manager import ConnectionManager

logger = logging.getLogger(__name__)


class SelectionPayload(BaseModel):
    from_: int = Field(alias="from")
    to: int

    model_config = ConfigDict(populate_by_name=True)


class BlockDelta(BaseModel):
    block_id: str
    action: Literal["insert", "update", "delete"]
    content: dict[str, Any] | None = None
    position: int | None = None


class ContentUpdateData(BaseModel):
    blocks: list[BlockDelta]


class CursorMoveData(BaseModel):
    position: int
    selection: SelectionPayload | None = None


class PresencePingData(BaseModel):
    model_config = ConfigDict(extra="ignore")


class ContentUpdateMessage(BaseModel):
    type: Literal["content_update"]
    data: ContentUpdateData


class CursorMoveMessage(BaseModel):
    type: Literal["cursor_move"]
    data: CursorMoveData


class PresencePingMessage(BaseModel):
    type: Literal["presence_ping"]
    data: PresencePingData | None = None


ClientMessage = ContentUpdateMessage | CursorMoveMessage | PresencePingMessage


class DraftState(TypedDict):
    note_id: str
    title: str
    content: dict[str, Any] | None
    version: int
    edited_by: str


_PRESENCE_TTL_SECONDS = 5
_DRAFT_TTL_SECONDS = 300
_DEBOUNCE_SECONDS = 2.0
_STATE_LOCK_TTL_SECONDS = 10
_STATE_LOCK_RETRIES = 20
_STATE_LOCK_RETRY_DELAY_SECONDS = 0.05

_flush_tasks: dict[str, asyncio.Task[None]] = {}
_flush_task_lock = asyncio.Lock()
_local_drafts: dict[str, DraftState] = {}
_local_draft_lock = asyncio.Lock()


def user_color(user_id: uuid.UUID | str) -> str:
    digest = hashlib.sha256(str(user_id).encode("utf-8")).hexdigest()
    return f"#{digest[:6]}"


def serialize_selection(selection: SelectionPayload | None) -> dict[str, int] | None:
    if selection is None:
        return None
    return {"from": selection.from_, "to": selection.to}


def presence_user_payload(user: User) -> dict[str, Any]:
    return {
        "user_id": str(user.id),
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "color": user_color(user.id),
    }


def make_sync_state_message(
    note: Note,
    users: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "type": "sync_state",
        "data": {
            "content": note.content,
            "version": note.version,
            "users": users,
        },
    }


def make_user_joined_message(user: User) -> dict[str, Any]:
    return {
        "type": "user_joined",
        "data": {
            "user_id": str(user.id),
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
        },
    }


def make_user_left_message(user_id: uuid.UUID | str) -> dict[str, Any]:
    return {
        "type": "user_left",
        "data": {
            "user_id": str(user_id),
        },
    }


def make_error_message(code: str, message: str) -> dict[str, Any]:
    return {
        "type": "error",
        "data": {
            "code": code,
            "message": message,
        },
    }


def _draft_key(note_id: uuid.UUID | str) -> str:
    return f"collab:{note_id}:draft"


def _state_lock_key(note_id: uuid.UUID | str) -> str:
    return f"collab:{note_id}:state_lock"


def _ensure_doc(content: dict[str, Any] | None) -> dict[str, Any]:
    if isinstance(content, dict):
        doc = deepcopy(content)
        doc_content = doc.get("content")
        if isinstance(doc_content, list):
            return doc
        doc["type"] = doc.get("type", "doc")
        doc["content"] = []
        return doc
    return {"type": "doc", "content": []}


def _node_block_id(node: Any) -> str | None:
    if not isinstance(node, dict):
        return None

    attrs = node.get("attrs")
    if isinstance(attrs, dict):
        for key in ("block_id", "id"):
            value = attrs.get(key)
            if isinstance(value, str) and value:
                return value

    for key in ("block_id", "id"):
        value = node.get(key)
        if isinstance(value, str) and value:
            return value

    return None


def _assign_block_id(node: dict[str, Any], block_id: str) -> dict[str, Any]:
    copy = deepcopy(node)
    attrs = copy.get("attrs")
    if not isinstance(attrs, dict):
        attrs = {}
        copy["attrs"] = attrs
    attrs.setdefault("block_id", block_id)
    attrs.setdefault("id", block_id)
    return copy


def apply_block_deltas(
    content: dict[str, Any] | None,
    blocks: list[BlockDelta],
) -> dict[str, Any]:
    doc = _ensure_doc(content)
    doc_blocks = doc.get("content")
    if not isinstance(doc_blocks, list):
        doc_blocks = []
        doc["content"] = doc_blocks

    nodes = cast(list[Any], doc_blocks)

    for block in blocks:
        existing_index = next(
            (
                index
                for index, node in enumerate(nodes)
                if _node_block_id(node) == block.block_id
            ),
            None,
        )

        if block.action == "delete":
            if existing_index is not None:
                nodes.pop(existing_index)
            continue

        if block.content is None:
            continue

        block_content = _assign_block_id(block.content, block.block_id)

        if block.action == "insert":
            if existing_index is not None:
                nodes.pop(existing_index)

            target_index = block.position if block.position is not None else len(nodes)
            if target_index < 0:
                target_index = 0
            if target_index > len(nodes):
                target_index = len(nodes)
            nodes.insert(target_index, block_content)
            continue

        if block.action == "update":
            if existing_index is not None:
                nodes[existing_index] = block_content
            else:
                target_index = (
                    block.position if block.position is not None else len(nodes)
                )
                if target_index < 0:
                    target_index = 0
                if target_index > len(nodes):
                    target_index = len(nodes)
                nodes.insert(target_index, block_content)

    return doc


@asynccontextmanager
async def state_lock(note_id: uuid.UUID | str):
    redis = get_redis()
    lock_key = _state_lock_key(note_id)
    token = str(uuid.uuid4())

    for _ in range(_STATE_LOCK_RETRIES):
        acquired = False
        try:
            acquired = bool(
                await redis.set(
                    lock_key,
                    token,
                    ex=_STATE_LOCK_TTL_SECONDS,
                    nx=True,
                )
            )
        except Exception:
            logger.exception(
                "Failed to acquire collaboration state lock for note %s", note_id
            )
            break

        if acquired:
            try:
                yield
            finally:
                try:
                    current = await redis.get(lock_key)
                    if current == token:
                        await redis.delete(lock_key)
                except Exception:
                    logger.exception(
                        "Failed to release collaboration state lock for note %s",
                        note_id,
                    )
            return

        await asyncio.sleep(_STATE_LOCK_RETRY_DELAY_SECONDS)

    raise RuntimeError(f"Unable to acquire collaboration state lock for note {note_id}")


async def _get_local_draft(note_id: uuid.UUID | str) -> DraftState | None:
    async with _local_draft_lock:
        draft = _local_drafts.get(str(note_id))
        return deepcopy(draft) if draft is not None else None


async def _set_local_draft(note_id: uuid.UUID | str, draft: DraftState) -> None:
    async with _local_draft_lock:
        _local_drafts[str(note_id)] = deepcopy(draft)


async def _clear_local_draft(note_id: uuid.UUID | str) -> None:
    async with _local_draft_lock:
        _local_drafts.pop(str(note_id), None)


async def load_draft_state(note_id: uuid.UUID | str) -> DraftState | None:
    try:
        redis = get_redis()
        raw = await redis.get(_draft_key(note_id))
        if raw:
            payload = json.loads(raw)
            if isinstance(payload, dict):
                draft_state: DraftState = {
                    "note_id": str(payload["note_id"]),
                    "title": str(payload["title"]),
                    "content": payload.get("content")
                    if isinstance(payload.get("content"), dict)
                    else None,
                    "version": int(payload["version"]),
                    "edited_by": str(payload["edited_by"]),
                }
                await _set_local_draft(note_id, draft_state)
                return draft_state

            logger.warning(
                "Ignoring invalid collaboration draft payload for note %s", note_id
            )
            return None
    except Exception:
        logger.exception("Failed to load collaboration draft for note %s", note_id)

    return await _get_local_draft(note_id)


async def store_draft_state(note_id: uuid.UUID | str, draft: DraftState) -> None:
    await _set_local_draft(note_id, draft)
    try:
        redis = get_redis()
        await redis.setex(_draft_key(note_id), _DRAFT_TTL_SECONDS, json.dumps(draft))
    except Exception:
        logger.exception("Failed to store collaboration draft for note %s", note_id)


async def clear_draft_state(note_id: uuid.UUID | str) -> None:
    await _clear_local_draft(note_id)
    try:
        redis = get_redis()
        await redis.delete(_draft_key(note_id))
    except Exception:
        logger.exception("Failed to clear collaboration draft for note %s", note_id)


async def _load_persisted_note_state(note_id: uuid.UUID | str) -> dict[str, Any] | None:
    try:
        note_uuid = uuid.UUID(str(note_id))
    except ValueError:
        return None

    try:
        async with AsyncSessionLocal() as db:
            persisted_note = await db.get(Note, note_uuid)
            if persisted_note is None:
                return None

            return {
                "title": persisted_note.title,
                "content": persisted_note.content,
                "version": persisted_note.version,
            }
    except Exception:
        logger.exception("Failed to reload persisted note state for note %s", note_id)
        return None


async def get_live_note_state(note: Note) -> Note:
    draft = await load_draft_state(note.id)
    if draft is not None:
        note.content = draft["content"]
        note.version = draft["version"]
        return note

    persisted_state = await _load_persisted_note_state(note.id)
    if persisted_state is None:
        return note

    note.title = str(persisted_state["title"])
    note.content = cast(dict[str, Any] | None, persisted_state["content"])
    note.version = int(persisted_state["version"])
    return note


async def list_presence_users_from_redis(
    note_id: uuid.UUID | str,
) -> list[dict[str, Any]]:
    try:
        redis = get_redis()
        key = f"collab:{note_id}:users"
        raw_users = await redis.hgetall(key)
    except Exception:
        logger.exception("Failed to read collaboration presence for note %s", note_id)
        return []

    users: list[dict[str, Any]] = []
    for raw_value in raw_users.values():
        try:
            payload = json.loads(raw_value)
        except (TypeError, ValueError):
            logger.warning(
                "Ignoring invalid collaboration presence payload for note %s",
                note_id,
            )
            continue

        if not isinstance(payload, dict):
            continue

        user_id = payload.get("user_id")
        if not user_id:
            continue

        users.append(
            {
                "user_id": str(user_id),
                "display_name": payload.get("display_name") or "Unknown User",
                "avatar_url": payload.get("avatar_url"),
                "color": payload.get("color") or user_color(str(user_id)),
            }
        )

    return users


async def list_presence_users(
    manager: ConnectionManager,
    note_id: uuid.UUID | str,
    user_lookup: dict[str, User] | None = None,
) -> list[dict[str, Any]]:
    redis_users = await list_presence_users_from_redis(note_id)
    if redis_users:
        if not user_lookup:
            return redis_users

        seen_user_ids = {str(user["user_id"]) for user in redis_users}
        merged_users = list(redis_users)
        for user_id, user in user_lookup.items():
            if user_id in seen_user_ids:
                continue
            merged_users.append(presence_user_payload(user))
        return merged_users

    user_ids = await manager.get_room_user_ids(note_id)
    if not user_lookup:
        return [
            {
                "user_id": user_id,
                "display_name": "Unknown User",
                "avatar_url": None,
                "color": user_color(user_id),
            }
            for user_id in user_ids
        ]

    users: list[dict[str, Any]] = []
    for user_id in user_ids:
        user = user_lookup.get(user_id)
        if user is None:
            users.append(
                {
                    "user_id": user_id,
                    "display_name": "Unknown User",
                    "avatar_url": None,
                    "color": user_color(user_id),
                }
            )
            continue
        users.append(presence_user_payload(user))
    return users


async def parse_client_message(payload: Any) -> ClientMessage:
    if isinstance(payload, str):
        payload = json.loads(payload)

    if not isinstance(payload, dict):
        raise ValueError("WebSocket payload must be a JSON object")

    message_type = payload.get("type")
    if message_type == "content_update":
        return ContentUpdateMessage.model_validate(payload)
    if message_type == "cursor_move":
        return CursorMoveMessage.model_validate(payload)
    if message_type == "presence_ping":
        return PresencePingMessage.model_validate(payload)

    raise ValueError(f"Unsupported websocket message type: {message_type}")


async def handle_client_message(
    manager: ConnectionManager,
    websocket: WebSocket,
    note: Note,
    user: User,
    payload: Any,
) -> None:
    try:
        message = await parse_client_message(payload)
    except json.JSONDecodeError:
        await websocket.send_json(
            make_error_message("invalid_json", "Malformed JSON payload")
        )
        return
    except ValidationError as exc:
        await websocket.send_json(
            make_error_message(
                "invalid_message",
                exc.errors()[0]["msg"] if exc.errors() else "Invalid message",
            )
        )
        return
    except ValueError as exc:
        await websocket.send_json(make_error_message("unsupported_message", str(exc)))
        return

    if isinstance(message, ContentUpdateMessage):
        try:
            await handle_content_update(manager, note, user, message.data)
        except Exception:
            logger.exception("Failed to handle content update for note %s", note.id)
            await websocket.send_json(
                make_error_message(
                    "content_update_failed",
                    "Unable to process content update",
                )
            )
        return

    if isinstance(message, CursorMoveMessage):
        await handle_cursor_move(manager, note.id, user, message.data)
        return

    await handle_presence_ping(note.id, user)


async def stage_content_update(
    note: Note,
    user: User,
    data: ContentUpdateData,
) -> DraftState:
    async with state_lock(note.id):
        current_draft = await load_draft_state(note.id)
        base_content = note.content
        base_version = note.version
        base_title = note.title

        if current_draft is not None:
            base_content = current_draft["content"]
            base_version = current_draft["version"]
            base_title = current_draft["title"]
        else:
            persisted_state = await _load_persisted_note_state(note.id)
            if persisted_state is not None:
                base_content = cast(dict[str, Any] | None, persisted_state["content"])
                base_version = int(persisted_state["version"])
                base_title = str(persisted_state["title"])

        next_content = apply_block_deltas(base_content, data.blocks)
        next_version = max(int(base_version or 0), int(note.version or 0)) + 1

        draft: DraftState = {
            "note_id": str(note.id),
            "title": base_title,
            "content": next_content,
            "version": next_version,
            "edited_by": str(user.id),
        }

        await store_draft_state(note.id, draft)

        note.title = base_title
        note.content = next_content
        note.version = next_version

        return draft


async def persist_note_draft(note_id: uuid.UUID | str) -> bool:
    async with state_lock(note_id):
        draft = await load_draft_state(note_id)
        if draft is None:
            return False

        try:
            note_uuid = uuid.UUID(str(note_id))
            editor_uuid = uuid.UUID(draft["edited_by"])
        except ValueError:
            logger.warning(
                "Skipping invalid collaboration draft identifiers for note %s", note_id
            )
            return False

        async with AsyncSessionLocal() as db:
            note = await db.get(Note, note_uuid)
            if note is None:
                return False

            if (note.version or 0) >= draft["version"]:
                await clear_draft_state(note_id)
                await db.commit()
                return False

            await note_service.persist_collaborative_note(
                db=db,
                note_id=note_uuid,
                user_id=editor_uuid,
                content=draft["content"],
                version=draft["version"],
            )
            await db.commit()

        await clear_draft_state(note_id)
        return True


async def _debounced_flush(note_id: str) -> None:
    try:
        await asyncio.sleep(_DEBOUNCE_SECONDS)
        await persist_note_draft(note_id)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception(
            "Debounced collaboration persistence failed for note %s", note_id
        )
    finally:
        async with _flush_task_lock:
            task = _flush_tasks.get(note_id)
            if task is asyncio.current_task():
                _flush_tasks.pop(note_id, None)


async def schedule_note_flush(note_id: uuid.UUID | str) -> None:
    note_key = str(note_id)
    async with _flush_task_lock:
        existing = _flush_tasks.get(note_key)
        if existing is not None:
            existing.cancel()
        _flush_tasks[note_key] = asyncio.create_task(_debounced_flush(note_key))


async def cancel_note_flush(note_id: uuid.UUID | str) -> None:
    note_key = str(note_id)
    task: asyncio.Task[None] | None = None

    async with _flush_task_lock:
        task = _flush_tasks.pop(note_key, None)

    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


async def flush_note_on_disconnect(note_id: uuid.UUID | str) -> None:
    await cancel_note_flush(note_id)
    try:
        await persist_note_draft(note_id)
    except Exception:
        logger.exception(
            "Failed to flush collaboration draft on disconnect for note %s", note_id
        )


async def handle_content_update(
    manager: ConnectionManager,
    note: Note,
    user: User,
    data: ContentUpdateData,
) -> int:
    draft = await stage_content_update(note, user, data)
    await schedule_note_flush(note.id)

    message = {
        "type": "content_update",
        "data": {
            "blocks": [block.model_dump(mode="json") for block in data.blocks],
            "user_id": str(user.id),
            "version": draft["version"],
        },
    }

    await manager.broadcast(note.id, message, exclude_user=user.id)
    return draft["version"]


async def handle_cursor_move(
    manager: ConnectionManager,
    note_id: uuid.UUID | str,
    user: User,
    data: CursorMoveData,
) -> None:
    message = {
        "type": "cursor_update",
        "data": {
            "user_id": str(user.id),
            "display_name": user.display_name,
            "color": user_color(user.id),
            "position": data.position,
            "selection": serialize_selection(data.selection),
        },
    }
    await manager.broadcast(note_id, message, exclude_user=user.id)


async def handle_presence_ping(
    note_id: uuid.UUID | str,
    user: User,
) -> bool:
    try:
        redis = get_redis()
        key = f"collab:{note_id}:users"
        await redis.hset(
            key,
            str(user.id),
            json.dumps(
                {
                    "user_id": str(user.id),
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                    "color": user_color(user.id),
                }
            ),
        )
        await redis.expire(key, _PRESENCE_TTL_SECONDS)
        return True
    except Exception:
        logger.exception("Failed to update collaboration presence for note %s", note_id)
        return False


async def clear_presence(
    note_id: uuid.UUID | str,
    user_id: uuid.UUID | str,
) -> bool:
    try:
        redis = get_redis()
        key = f"collab:{note_id}:users"
        await redis.hdel(key, str(user_id))
        return True
    except Exception:
        logger.exception("Failed to clear collaboration presence for note %s", note_id)
        return False
