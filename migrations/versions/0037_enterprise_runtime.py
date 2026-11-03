"""Encrypted provider connections, sync inbox and isolated configuration sandboxes."""
from alembic import op
import sqlalchemy as sa

revision = "0037_enterprise_runtime"
down_revision = "0036_module_ai"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("runtime_connections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False), sa.Column("name", sa.String(160), nullable=False),
        sa.Column("credentials", sa.JSON(), nullable=False), sa.Column("configuration", sa.JSON(), nullable=False),
        sa.Column("cursor", sa.Text()), sa.Column("status", sa.String(30), nullable=False),
        sa.Column("last_sync_at", sa.DateTime()), sa.Column("last_error", sa.String(250)))
    op.create_index("ix_runtime_connections_organization_id", "runtime_connections", ["organization_id"])
    op.create_index("ix_runtime_connections_owner_id", "runtime_connections", ["owner_id"])
    op.create_table("runtime_integration_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("connection_id", sa.Integer(), sa.ForeignKey("runtime_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_id", sa.String(250), nullable=False), sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("crm_resource", sa.String(50)), sa.Column("crm_record_id", sa.Integer()),
        sa.UniqueConstraint("connection_id", "external_id", name="uq_runtime_external_item"))
    op.create_index("ix_runtime_integration_items_organization_id", "runtime_integration_items", ["organization_id"])
    op.create_index("ix_runtime_integration_items_connection_id", "runtime_integration_items", ["connection_id"])
    op.create_table("runtime_sandboxes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False), sa.Column("base_digest", sa.String(64), nullable=False),
        sa.Column("configuration", sa.JSON(), nullable=False), sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False))
    op.create_index("ix_runtime_sandboxes_organization_id", "runtime_sandboxes", ["organization_id"])
    op.create_index("ix_runtime_sandboxes_owner_id", "runtime_sandboxes", ["owner_id"])
    op.create_table("runtime_integration_actions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("connection_id", sa.Integer(), sa.ForeignKey("runtime_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("request_key", sa.String(80), nullable=False), sa.Column("request_digest", sa.String(64), nullable=False),
        sa.Column("status", sa.String(30), nullable=False), sa.Column("reference", sa.String(250)),
        sa.UniqueConstraint("connection_id", "request_key", name="uq_runtime_action_request"))
    op.create_index("ix_runtime_integration_actions_organization_id", "runtime_integration_actions", ["organization_id"])
    op.create_index("ix_runtime_integration_actions_connection_id", "runtime_integration_actions", ["connection_id"])


def downgrade():
    op.drop_table("runtime_integration_actions")
    op.drop_table("runtime_integration_items")
    op.drop_table("runtime_connections")
    op.drop_table("runtime_sandboxes")
