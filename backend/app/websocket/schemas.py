from typing import Literal

from pydantic import BaseModel, Field


class MessageSendEvent(BaseModel):
    type: Literal["message.send"]
    client_message_id: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=4000)


class TypingEvent(BaseModel):
    type: Literal["typing.started", "typing.stopped"]


class ReadReceiptEvent(BaseModel):
    type: Literal["read.receipt"]
    last_read_sequence_number: int = Field(..., ge=0)


def error_event(code: str, message: str) -> dict:
    return {
        "type": "error",
        "code": code,
        "message": message,
    }
