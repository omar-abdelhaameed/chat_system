import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WebSocketSession(Base):
    __tablename__ = "websocket_sessions"
    __table_args__ = (
        UniqueConstraint("user_id", "room_id", name="uq_websocket_session_user_room"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"),
        index=True,
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_received_sequence: Mapped[int] = mapped_column(BigInteger, default=0)

    user = relationship("User", back_populates="websocket_sessions")
    room = relationship("Room", back_populates="websocket_sessions")
