from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.message import Message
from app.repositories.message_repository import list_room_messages
from app.services.room_service import ensure_room_member


def message_to_event(message: Message) -> dict:
    sender = message.sender
    return {
        "type": "message.created",
        "message_id": str(message.id),
        "room_id": str(message.room_id),
        "sender_id": str(message.sender_id),
        "sender_username": sender.username if sender else str(message.sender_id),
        "sender_profile_photo_url": sender.profile_photo_url if sender else None,
        "content": message.content,
        "sequence_number": message.sequence_number,
        "client_message_id": message.client_message_id,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


def get_room_message_history(
    db: Session,
    room_id,
    user,
    limit: int = 50,
    before_sequence: int | None = None,
) -> list[Message]:
    ensure_room_member(db, room_id, user.id)

    if before_sequence is not None and before_sequence < 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="before_sequence must be greater than 0",
        )

    bounded_limit = min(max(limit, 1), 100)
    return list_room_messages(
        db,
        room_id=room_id,
        limit=bounded_limit,
        before_sequence=before_sequence,
    )
