"""Persist anonymous Webform funnel events."""
from alembic import op
import sqlalchemy as sa
revision = "0034_webform_tracking"
down_revision = "0033_single_platform_owner_membership"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("webform_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("form_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("visitor_key", sa.String(64), nullable=False),
        sa.Column("event_type", sa.String(24), nullable=False),
        sa.Column("device", sa.String(20), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("source_url", sa.String(400), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_webform_events_form_created", "webform_events", ["organization_id", "form_id", "created_at"])
    op.create_index("ix_webform_events_visitor", "webform_events", ["form_id", "visitor_key"])

def downgrade():
    op.drop_index("ix_webform_events_visitor", table_name="webform_events")
    op.drop_index("ix_webform_events_form_created", table_name="webform_events")
    op.drop_table("webform_events")
