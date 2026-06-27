import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.services.message_service import get_room_message_history

router = APIRouter(tags=["messages"])


class MessageResponse(BaseModel):
    id: str
    room_id: str
    sender_id: str
    sender_username: str
    sender_profile_photo_url: str | None
    content: str
    sequence_number: int
    client_message_id: str
    created_at: str | None


def message_to_response(message) -> MessageResponse:
    sender = message.sender
    return MessageResponse(
        id=str(message.id),
        room_id=str(message.room_id),
        sender_id=str(message.sender_id),
        sender_username=sender.username if sender else str(message.sender_id),
        sender_profile_photo_url=sender.profile_photo_url if sender else None,
        content=message.content,
        sequence_number=message.sequence_number,
        client_message_id=message.client_message_id,
        created_at=message.created_at.isoformat() if message.created_at else None,
    )


@router.get("/rooms/{room_id}/messages", response_model=list[MessageResponse])
def list_room_messages(
    room_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    before_sequence: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    messages = get_room_message_history(
        db=db,
        room_id=room_id,
        user=current_user,
        limit=limit,
        before_sequence=before_sequence,
    )
    return [message_to_response(message) for message in messages]
