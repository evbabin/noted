from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from fastapi import WebSocket, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AuthenticationError, NotFoundError, PermissionDeniedError
from app.models.note import Note
from app.models.notebook import Notebook
from app.models.user import User
from app.models.workspace_member import WorkspaceMember
from app.redis import get_redis
from app.services import auth_service

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage active websocket connections and Redis pubsub fan-out."""

    def __init__(self) -> None:
        self.active_connections: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        self._lock: asyncio.Lock = asyncio.Lock()

        self.instance_id: str = str(uuid.uuid4())
        self._pubsub: Any | None = None
        self._pubsub_task: asyncio.Task[None] | None = None
        self._subscribed_notes: set[str] = set()
        self._pubsub_enabled: bool = False

    async def authenticate_user(self, token: str, db: AsyncSession) -> User:
        claims = auth_service.decode_token(token)
        if claims.get("type") != "access":
            raise AuthenticationError("Invalid token type")

        try:
            user_id = uuid.UUID(claims["sub"])
        except (KeyError, ValueError) as exc:
            raise AuthenticationError("Invalid token subject") from exc

        user = await db.get(User, user_id)
        if user is None or not user.is_active:
            raise AuthenticationError("User not found or inactive")
        return user

    async def get_note_with_membership(
        self,
        note_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> tuple[Note, WorkspaceMember]:
        note = await db.get(Note, note_id)
        if note is None:
            raise NotFoundError("Note not found")

        notebook = await db.get(Notebook, note.notebook_id)
        if notebook is None:
            raise NotFoundError("Note not found")

        result = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == notebook.workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise NotFoundError("Note not found")

        if membership.role is None:
            raise PermissionDeniedError("Insufficient workspace role")

        return note, membership

    async def start_pubsub(self) -> None:
        if self._pubsub_task is not None and not self._pubsub_task.done():
            return

        try:
            redis = get_redis()
            self._pubsub = redis.pubsub()
            self._pubsub_enabled = True
            self._pubsub_task = asyncio.create_task(self._listen_for_pubsub())
            logger.info("WebSocket Redis pubsub listener started")
        except Exception:
            self._pubsub = None
            self._pubsub_enabled = False
            self._pubsub_task = None
            logger.exception("Failed to start WebSocket Redis pubsub listener")

    async def stop_pubsub(self) -> None:
        task = self._pubsub_task
        self._pubsub_task = None

        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception:
                logger.exception("WebSocket Redis pubsub listener exited with error")

        pubsub = self._pubsub
        self._pubsub = None
        self._subscribed_notes.clear()
        self._pubsub_enabled = False

        if pubsub is not None:
            try:
                await pubsub.aclose()
            except Exception:
                logger.exception("Failed to close WebSocket Redis pubsub")

    async def connect(
        self,
        note_id: uuid.UUID | str,
        user_id: uuid.UUID | str,
        websocket: WebSocket,
    ) -> None:
        note_key = str(note_id)
        user_key = str(user_id)

        await websocket.accept()

        should_subscribe = False
        async with self._lock:
            room = self.active_connections[note_key]
            if not room:
                should_subscribe = True
            room[user_key] = websocket

        if should_subscribe:
            await self._ensure_room_subscription(note_key)

    async def disconnect(
        self,
        note_id: uuid.UUID | str,
        user_id: uuid.UUID | str,
    ) -> None:
        note_key = str(note_id)
        user_key = str(user_id)

        should_unsubscribe = False
        async with self._lock:
            room = self.active_connections.get(note_key)
            if room is None:
                return

            room.pop(user_key, None)
            if not room:
                self.active_connections.pop(note_key, None)
                should_unsubscribe = True

        if should_unsubscribe:
            await self._remove_room_subscription(note_key)

    async def broadcast(
        self,
        note_id: uuid.UUID | str,
        message: dict[str, Any],
        exclude_user: uuid.UUID | str | None = None,
        *,
        publish: bool = True,
    ) -> None:
        await self._broadcast_local(note_id, message, exclude_user=exclude_user)

        if publish:
            await self._publish_remote(note_id, message, exclude_user=exclude_user)

    async def send_to_user(
        self,
        note_id: uuid.UUID | str,
        user_id: uuid.UUID | str,
        message: dict[str, Any],
    ) -> None:
        note_key = str(note_id)
        user_key = str(user_id)

        async with self._lock:
            websocket = self.active_connections.get(note_key, {}).get(user_key)

        if websocket is None:
            return

        try:
            await websocket.send_json(message)
        except Exception:
            await self.disconnect(note_key, user_key)

    async def get_room_user_ids(self, note_id: uuid.UUID | str) -> list[str]:
        async with self._lock:
            return list(self.active_connections.get(str(note_id), {}).keys())

    async def is_connected(
        self,
        note_id: uuid.UUID | str,
        user_id: uuid.UUID | str,
    ) -> bool:
        async with self._lock:
            return str(user_id) in self.active_connections.get(str(note_id), {})

    async def room_size(self, note_id: uuid.UUID | str) -> int:
        async with self._lock:
            return len(self.active_connections.get(str(note_id), {}))

    async def close_user_connections(
        self,
        note_ids: Iterable[uuid.UUID | str],
        user_id: uuid.UUID | str,
        *,
        close_code: int = status.WS_1008_POLICY_VIOLATION,
    ) -> None:
        """Force-close a user's sockets across multiple note rooms."""
        user_key = str(user_id)
        for note_id in note_ids:
            note_key = str(note_id)
            async with self._lock:
                websocket = self.active_connections.get(note_key, {}).get(user_key)

            if websocket is None:
                continue

            try:
                await websocket.close(code=close_code)
            except Exception:
                logger.exception(
                    "Failed to close websocket for note %s and user %s",
                    note_key,
                    user_key,
                )

            await self.disconnect(note_key, user_key)

    def channel_name(self, note_id: uuid.UUID | str) -> str:
        return f"collab:{note_id}:events"

    async def _broadcast_local(
        self,
        note_id: uuid.UUID | str,
        message: dict[str, Any],
        exclude_user: uuid.UUID | str | None = None,
    ) -> None:
        recipients = await self._get_room_connections(
            note_id=note_id,
            exclude_user=exclude_user,
        )
        if not recipients:
            return

        stale_users: list[str] = []
        for user_key, websocket in recipients:
            try:
                await websocket.send_json(message)
            except Exception:
                stale_users.append(user_key)

        for user_key in stale_users:
            await self.disconnect(note_id, user_key)

    async def _publish_remote(
        self,
        note_id: uuid.UUID | str,
        message: dict[str, Any],
        exclude_user: uuid.UUID | str | None = None,
    ) -> None:
        if not self._pubsub_enabled:
            return

        try:
            redis = get_redis()
            payload = {
                "origin": self.instance_id,
                "note_id": str(note_id),
                "exclude_user": str(exclude_user) if exclude_user is not None else None,
                "message": message,
            }
            await redis.publish(self.channel_name(note_id), json.dumps(payload))
        except Exception:
            logger.exception(
                "Failed to publish collaboration message for note %s", note_id
            )

    async def _ensure_room_subscription(self, note_id: str) -> None:
        if not self._pubsub_enabled or self._pubsub is None:
            return

        if note_id in self._subscribed_notes:
            return

        try:
            await self._pubsub.subscribe(self.channel_name(note_id))
            self._subscribed_notes.add(note_id)
        except Exception:
            logger.exception(
                "Failed to subscribe to collaboration channel for note %s", note_id
            )

    async def _remove_room_subscription(self, note_id: str) -> None:
        if not self._pubsub_enabled or self._pubsub is None:
            return

        if note_id not in self._subscribed_notes:
            return

        try:
            await self._pubsub.unsubscribe(self.channel_name(note_id))
            self._subscribed_notes.discard(note_id)
        except Exception:
            logger.exception(
                "Failed to unsubscribe from collaboration channel for note %s",
                note_id,
            )

    async def _listen_for_pubsub(self) -> None:
        if self._pubsub is None:
            return

        try:
            while True:
                # Redis pubsub objects do not establish a dedicated connection
                # until at least one channel has been subscribed. The listener is
                # started eagerly during app startup, so on an idle instance we
                # intentionally wait for the first room subscription instead of
                # treating that pre-subscription state as a crash.
                if not self._subscribed_notes:
                    await asyncio.sleep(0.05)
                    continue

                try:
                    message = await self._pubsub.get_message(
                        ignore_subscribe_messages=True,
                        timeout=1.0,
                    )
                except RuntimeError as exc:
                    if "pubsub connection not set" in str(exc).lower():
                        await asyncio.sleep(0.05)
                        continue
                    raise

                if message is None:
                    await asyncio.sleep(0.05)
                    continue

                if message.get("type") != "message":
                    continue

                raw_data = message.get("data")
                if raw_data is None:
                    continue

                try:
                    payload = json.loads(raw_data)
                except (TypeError, ValueError):
                    logger.warning("Ignoring invalid collaboration pubsub payload")
                    continue

                if payload.get("origin") == self.instance_id:
                    continue

                note_id = payload.get("note_id")
                forwarded_message = payload.get("message")
                exclude_user = payload.get("exclude_user")

                if not note_id or not isinstance(forwarded_message, dict):
                    continue

                await self._broadcast_local(
                    note_id,
                    forwarded_message,
                    exclude_user=exclude_user,
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("WebSocket Redis pubsub listener crashed")

    async def _get_room_connections(
        self,
        note_id: uuid.UUID | str,
        exclude_user: uuid.UUID | str | None = None,
    ) -> list[tuple[str, WebSocket]]:
        note_key = str(note_id)
        excluded = str(exclude_user) if exclude_user is not None else None

        async with self._lock:
            room: dict[str, WebSocket] = self.active_connections.get(note_key, {})
            items: Iterable[tuple[str, WebSocket]] = room.items()
            return [
                (user_key, websocket)
                for user_key, websocket in items
                if user_key != excluded
            ]


manager = ConnectionManager()
