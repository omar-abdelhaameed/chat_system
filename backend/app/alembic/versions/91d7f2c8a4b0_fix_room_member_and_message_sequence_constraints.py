"""fix room member and message sequence constraints

Revision ID: 91d7f2c8a4b0
Revises: ff2f179b2c45
Create Date: 2026-05-04 21:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "91d7f2c8a4b0"
down_revision: Union[str, Sequence[str], None] = "ff2f179b2c45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove accidental standalone uniqueness, if it exists."""
    op.execute("DROP INDEX IF EXISTS ix_messages_sequence_number")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_class c
                JOIN pg_index i ON i.indexrelid = c.oid
                WHERE c.relname = 'ix_room_members_user_id'
                AND i.indisunique
            ) THEN
                EXECUTE 'DROP INDEX ix_room_members_user_id';
            END IF;
        END $$;
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_room_members_user_id ON room_members (user_id)"
    )


def downgrade() -> None:
    """Do not recreate constraints that break the intended room/message model."""
    pass
