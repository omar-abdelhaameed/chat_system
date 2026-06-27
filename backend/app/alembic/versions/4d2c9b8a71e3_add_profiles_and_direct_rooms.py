"""add profile fields and direct rooms

Revision ID: 4d2c9b8a71e3
Revises: 91d7f2c8a4b0
Create Date: 2026-05-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4d2c9b8a71e3"
down_revision: Union[str, Sequence[str], None] = "91d7f2c8a4b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("birthday", sa.Date(), nullable=True))
    op.add_column(
        "users",
        sa.Column("profile_photo_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "rooms",
        sa.Column("is_direct", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("rooms", sa.Column("direct_key", sa.String(length=80), nullable=True))
    op.create_index(op.f("ix_rooms_direct_key"), "rooms", ["direct_key"], unique=True)
    op.alter_column("rooms", "is_direct", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_rooms_direct_key"), table_name="rooms")
    op.drop_column("rooms", "direct_key")
    op.drop_column("rooms", "is_direct")
    op.drop_column("users", "profile_photo_url")
    op.drop_column("users", "birthday")
