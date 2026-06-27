import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.queue import publish_incoming_message
from app.core.redis import allow_message_send, publish_room_event
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.websocket_session import WebSocketSession
from app.repositories.message_repository import list_missed_room_messages
from app.repositories.user_repository import get_user_by_id
from app.services.message_service import message_to_event
from app.services.receipt_service import update_and_publish_read_state
from app.services.room_service import ensure_room_member
from app.websocket.manager import manager
from app.websocket.schemas import (
    MessageSendEvent,
    ReadReceiptEvent,
    TypingEvent,
    error_event,
)

UNAUTHORIZED_CLOSE_CODE = 4401
FORBIDDEN_CLOSE_CODE = 4403


def _query_int(websocket: WebSocket, name: str, default: int = 0) -> int:
    raw_value = websocket.query_params.get(name)
    if raw_value is None:
        return default
    try:
        return max(int(raw_value), 0)
    except ValueError:
        return default


def _authenticate_websocket(db: Session, token: str | None):
    if not token:
        return None

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        return None
    return user


def _upsert_websocket_session(
    db: Session,
    session_id: str | None,
    user_id,
    room_id,
    last_received_sequence: int,
) -> WebSocketSession:
    result = db.execute(
        select(WebSocketSession).where(
            WebSocketSession.user_id == user_id,
            WebSocketSession.room_id == room_id,
        )
    )
    websocket_session = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if websocket_session is None:
        websocket_session_id = None
        if session_id:
            try:
                websocket_session_id = uuid.UUID(session_id)
            except ValueError:
                websocket_session_id = None

        websocket_session = WebSocketSession(
            id=websocket_session_id or uuid.uuid4(),
            user_id=user_id,
            room_id=room_id,
            last_received_sequence=last_received_sequence,
            last_seen_at=now,
        )
        db.add(websocket_session)
    else:
        websocket_session.last_received_sequence = max(
            websocket_session.last_received_sequence,
            last_received_sequence,
        )
        websocket_session.last_seen_at = now

    db.commit()
    db.refresh(websocket_session)
    return websocket_session


def _touch_websocket_session(db: Session, user_id, room_id, last_sequence: int) -> None:
    result = db.execute(
        select(WebSocketSession).where(
            WebSocketSession.user_id == user_id,
            WebSocketSession.room_id == room_id,
        )
    )
    websocket_session = result.scalar_one_or_none()
    if websocket_session is None:
        return

    websocket_session.last_received_sequence = max(
        websocket_session.last_received_sequence,
        last_sequence,
    )
    websocket_session.last_seen_at = datetime.now(timezone.utc)
    db.commit()


async def _send_missed_messages(
    websocket: WebSocket,
    db: Session,
    room_id,
    last_sequence: int,
) -> None:
    missed_messages = list_missed_room_messages(
        db=db,
        room_id=room_id,
        after_sequence=last_sequence,
        limit=100,
    )
    for message in missed_messages:
        await websocket.send_json(message_to_event(message))


async def _handle_message_send(websocket: WebSocket, room_id, user, payload: dict) -> None:
    try:
        event = MessageSendEvent(**payload)
    except ValidationError:
        await websocket.send_json(error_event("INVALID_EVENT", "Invalid message payload."))
        return

    allowed = await allow_message_send(user.id)
    if not allowed:
        await websocket.send_json(
            error_event(
                "RATE_LIMIT_EXCEEDED",
                "You can send up to 10 messages per second.",
            )
        )
        return

    try:
        await publish_incoming_message(
            {
                "room_id": str(room_id),
                "sender_id": str(user.id),
                "client_message_id": event.client_message_id,
                "content": event.content,
            }
        )
    except Exception:
        await websocket.send_json(
            error_event("MESSAGE_SEND_FAILED", "Message could not be queued.")
        )


async def _handle_typing(room_id, user, payload: dict) -> None:
    event = TypingEvent(**payload)
    await publish_room_event(
        room_id,
        {
            "type": event.type,
            "room_id": str(room_id),
            "user_id": str(user.id),
        },
    )


async def _handle_read_receipt(
    websocket: WebSocket,
    db: Session,
    room_id,
    user,
    payload: dict,
) -> None:
    try:
        event = ReadReceiptEvent(**payload)
    except ValidationError:
        await websocket.send_json(error_event("INVALID_EVENT", "Invalid read receipt."))
        return

    await update_and_publish_read_state(
        db=db,
        room_id=room_id,
        user=user,
        last_read_sequence_number=event.last_read_sequence_number,
    )


async def room_websocket(websocket: WebSocket, room_id: uuid.UUID) -> None:
    db = SessionLocal()
    user = _authenticate_websocket(db, websocket.query_params.get("token"))
    if user is None:
        await websocket.close(code=UNAUTHORIZED_CLOSE_CODE)
        db.close()
        return

    try:
        ensure_room_member(db, room_id, user.id)
    except HTTPException:
        await websocket.close(code=FORBIDDEN_CLOSE_CODE)
        db.close()
        return

    last_sequence = _query_int(websocket, "last_sequence", default=0)
    session = _upsert_websocket_session(
        db=db,
        session_id=websocket.query_params.get("session_id"),
        user_id=user.id,
        room_id=room_id,
        last_received_sequence=last_sequence,
    )

    await manager.connect(room_id, websocket)
    await websocket.send_json(
        {
            "type": "connection.ready",
            "room_id": str(room_id),
            "session_id": str(session.id),
            "last_received_sequence": session.last_received_sequence,
        }
    )
    await _send_missed_messages(websocket, db, room_id, last_sequence)

    try:
        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type")

            if event_type == "message.send":
                await _handle_message_send(websocket, room_id, user, payload)
            elif event_type in {"typing.started", "typing.stopped"}:
                try:
                    await _handle_typing(room_id, user, payload)
                except ValidationError:
                    await websocket.send_json(
                        error_event("INVALID_EVENT", "Invalid typing event.")
                    )
            elif event_type == "read.receipt":
                await _handle_read_receipt(websocket, db, room_id, user, payload)
                _touch_websocket_session(
                    db,
                    user_id=user.id,
                    room_id=room_id,
                    last_sequence=payload.get("last_read_sequence_number", 0),
                )
            else:
                await websocket.send_json(
                    error_event("UNKNOWN_EVENT", "Unsupported WebSocket event type.")
                )
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(room_id, websocket)
        db.close()
