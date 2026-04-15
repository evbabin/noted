import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User
from app.websocket.handlers import (
    clear_presence,
    flush_note_on_disconnect,
    get_live_note_state,
    handle_client_message,
    handle_presence_ping,
    list_presence_users,
    make_error_message,
    make_sync_state_message,
    make_user_joined_message,
    make_user_left_message,
)
from app.websocket.manager import manager

router = APIRouter()


async def _close_with_error(
    websocket: WebSocket,
    *,
    code: str,
    message: str,
    close_code: int = status.WS_1008_POLICY_VIOLATION,
) -> None:
    await websocket.accept()
    await websocket.send_json(make_error_message(code, message))
    await websocket.close(code=close_code)


async def _load_room_users(note_id: uuid.UUID) -> dict[str, User]:
    user_ids = await manager.get_room_user_ids(note_id)
    parsed_ids: list[uuid.UUID] = []
    for user_id in user_ids:
        try:
            parsed_ids.append(uuid.UUID(user_id))
        except ValueError:
            continue

    if not parsed_ids:
        return {}

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id.in_(parsed_ids)))
        users = result.scalars().all()
        return {str(user.id): user for user in users}


@router.websocket("/ws/{note_id}")
async def websocket_note_endpoint(websocket: WebSocket, note_id: uuid.UUID) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await _close_with_error(
            websocket,
            code="missing_token",
            message="Missing access token",
        )
        return

    try:
        async with AsyncSessionLocal() as db:
            user = await manager.authenticate_user(token, db)
            note, _membership = await manager.get_note_with_membership(
                note_id, user.id, db
            )
    except Exception as exc:
        detail = getattr(exc, "detail", "Unable to authenticate websocket connection")
        await _close_with_error(
            websocket,
            code="authentication_failed",
            message=str(detail),
        )
        return

    await manager.connect(note_id, user.id, websocket)
    await handle_presence_ping(note_id, user)

    try:
        room_users = await _load_room_users(note_id)
        room_users[str(user.id)] = user
        live_note = await get_live_note_state(note)

        await manager.send_to_user(
            note_id,
            user.id,
            make_sync_state_message(
                live_note,
                await list_presence_users(manager, note_id, room_users),
            ),
        )
        await manager.broadcast(
            note_id,
            make_user_joined_message(user),
            exclude_user=user.id,
        )

        while True:
            try:
                payload = await websocket.receive_text()
            except RuntimeError as exc:
                # Some clients can disappear between the websocket accept and the
                # next receive call. Starlette raises a RuntimeError in that case
                # instead of WebSocketDisconnect, so we treat this specific state
                # as a normal disconnect to avoid noisy server tracebacks.
                if 'WebSocket is not connected. Need to call "accept" first.' in str(
                    exc
                ):
                    break
                raise

            await handle_client_message(manager, websocket, live_note, user, payload)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await flush_note_on_disconnect(note_id)
        except Exception:
            pass

        await manager.disconnect(note_id, user.id)
        try:
            await clear_presence(note_id, user.id)
            await manager.broadcast(note_id, make_user_left_message(user.id))
        except Exception:
            pass
