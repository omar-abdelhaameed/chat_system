from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.message import Message


def get_message_by_id(db: Session, message_id):
    result = db.execute(select(Message).where(Message.id == message_id))
    return result.scalar_one_or_none()


def get_message_by_client_id(db: Session, sender_id, client_message_id):
    result = db.execute(
        select(Message).where(
            Message.sender_id == sender_id,
            Message.client_message_id == client_message_id,
        )
    )
    return result.scalar_one_or_none()


def list_room_messages(db: Session, room_id, limit=50, before_sequence=None):
    statement = select(Message).where(Message.room_id == room_id)

    if before_sequence is not None:
        statement = statement.where(Message.sequence_number < before_sequence)

    result = db.execute(
        statement
        .order_by(Message.sequence_number.desc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return list(reversed(messages))


def list_missed_room_messages(db: Session, room_id, after_sequence=0, limit=100):
    result = db.execute(
        select(Message)
        .where(
            Message.room_id == room_id,
            Message.sequence_number > after_sequence,
        )
        .order_by(Message.sequence_number.asc())
        .limit(limit)
    )
    return result.scalars().all()


def create_message(
    db: Session,
    room_id,
    sender_id,
    content,
    sequence_number,
    client_message_id,
):
    message = Message(
        room_id=room_id,
        sender_id=sender_id,
        content=content,
        sequence_number=sequence_number,
        client_message_id=client_message_id,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
