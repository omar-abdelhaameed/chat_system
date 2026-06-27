import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.redis import publish_room_event
from app.models.message import Message
from app.models.room import Room
from app.repositories.message_repository import get_message_by_client_id
from app.repositories.room_repository import get_room_member
from app.services.message_service import message_to_event

logger = logging.getLogger(__name__)


class MessageWorkerError(Exception):
    pass


def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError) as exc:
        raise MessageWorkerError(f"Invalid {field_name}") from exc


def _load_existing_message(db: Session, sender_id, client_message_id) -> Message | None:
    if not client_message_id:
        return None
    return get_message_by_client_id(db, sender_id, client_message_id)


def persist_ordered_message(db: Session, payload: dict) -> Message:
    room_id = _parse_uuid(payload.get("room_id"), "room_id")
    sender_id = _parse_uuid(payload.get("sender_id"), "sender_id")
    client_message_id = str(payload.get("client_message_id", "")).strip()
    content = str(payload.get("content", "")).strip()

    if not client_message_id:
        raise MessageWorkerError("client_message_id is required")
    if not content:
        raise MessageWorkerError("content is required")

    existing = _load_existing_message(db, sender_id, client_message_id)
    if existing is not None:
        return existing

    room = db.execute(
        select(Room)
        .where(Room.id == room_id)
        .with_for_update()
    ).scalar_one_or_none()
    if room is None:
        raise MessageWorkerError("Room not found")

    membership = get_room_member(db, room_id, sender_id)
    if membership is None:
        raise MessageWorkerError("Sender is not a room member")

    room.last_sequence_number += 1
    message = Message(
        room_id=room_id,
        sender_id=sender_id,
        content=content,
        sequence_number=room.last_sequence_number,
        client_message_id=client_message_id,
    )
    db.add(message)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = _load_existing_message(db, sender_id, client_message_id)
        if existing is not None:
            return existing
        raise

    db.refresh(message)
    return message


async def process_incoming_message(db: Session, payload: dict) -> dict:
    message = persist_ordered_message(db, payload)
    event = message_to_event(message)
    await publish_room_event(message.room_id, event)
    logger.info(
        "Published message %s for room %s sequence %s",
        message.id,
        message.room_id,
        message.sequence_number,
    )
    return event
