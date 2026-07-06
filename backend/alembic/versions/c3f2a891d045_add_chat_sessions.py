"""add chat sessions

Revision ID: c3f2a891d045
Revises: b1d1a394b969
Create Date: 2026-07-07 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3f2a891d045'
down_revision: Union[str, None] = 'b1d1a394b969'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'chat_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('household_id', sa.Integer(), sa.ForeignKey('households.id'), nullable=False),
        sa.Column('title', sa.String(), nullable=False, server_default='New chat'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_chat_sessions_id', 'chat_sessions', ['id'])

    op.add_column('chat_messages',
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_sessions.id'), nullable=True))
    op.create_index('ix_chat_messages_session_id', 'chat_messages', ['session_id'])


def downgrade() -> None:
    op.drop_index('ix_chat_messages_session_id', 'chat_messages')
    op.drop_column('chat_messages', 'session_id')
    op.drop_index('ix_chat_sessions_id', 'chat_sessions')
    op.drop_table('chat_sessions')
