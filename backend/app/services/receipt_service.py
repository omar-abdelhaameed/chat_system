from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.redis import publish_room_event
from app.models.read_state import RoomReadState
from app.services.room_service import ensure_room_member


def read_state_to_event(read_state: RoomReadState) -> dict:
    user = read_state.user
    return {
        "type": "read.receipt",
        "room_id": str(read_state.room_id),
        "user_id": str(read_state.user_id),
        "user_username": user.username if user else str(read_state.user_id),
        "user_profile_photo_url": user.profile_photo_url if user else None,
        "last_read_sequence_number": read_state.last_read_sequence_number,
        "read_at": read_state.read_at.isoformat() if read_state.read_at else None,
    }


def update_room_read_state(
    db: Session,
    room_id,
    user,
    last_read_sequence_number: int,
) -> RoomReadState:
    ensure_room_member(db, room_id, user.id)

    if last_read_sequence_number < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="last_read_sequence_number must be greater than or equal to 0",
        )

    result = db.execute(
        select(RoomReadState).where(
            RoomReadState.room_id == room_id,
            RoomReadState.user_id == user.id,
        )
    )
    read_state = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if read_state is None:
        read_state = RoomReadState(
            room_id=room_id,
            user_id=user.id,
            last_read_sequence_number=last_read_sequence_number,
            read_at=now,
        )
        db.add(read_state)
    else:
        read_state.last_read_sequence_number = max(
            read_state.last_read_sequence_number,
            last_read_sequence_number,
        )
        read_state.read_at = now

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Read state could not be updated",
        )

    db.refresh(read_state)
    return read_state


async def update_and_publish_read_state(
    db: Session,
    room_id,
    user,
    last_read_sequence_number: int,
) -> RoomReadState:
    read_state = update_room_read_state(
        db=db,
        room_id=room_id,
        user=user,
        last_read_sequence_number=last_read_sequence_number,
    )
    await publish_room_event(room_id, read_state_to_event(read_state))
    return read_state
