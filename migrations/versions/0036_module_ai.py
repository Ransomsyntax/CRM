"""Durable APEX integration across modules."""
from alembic import op
import sqlalchemy as sa

revision = "0036_module_ai"
down_revision = "0035_subscription_permissions"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("module_ai_jobs", "module_ai_operations", "module_ai_automations"):
        columns = [sa.Column("id", sa.Integer(), primary_key=True),
                   sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False),
                   sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False)]
        if table == "module_ai_jobs":
            columns += [sa.Column("resource", sa.String(100), nullable=False), sa.Column("question", sa.Text(), nullable=False),
                        sa.Column("record_id", sa.Integer()), sa.Column("automation_id", sa.Integer()),
                        sa.Column("status", sa.String(24), nullable=False), sa.Column("result", sa.JSON(), nullable=False),
                        sa.Column("error", sa.String(500)), sa.Column("updated_at", sa.DateTime(), nullable=False)]
        elif table == "module_ai_operations":
            columns += [sa.Column("job_id", sa.Integer(), sa.ForeignKey("module_ai_jobs.id"), nullable=False),
                        sa.Column("action", sa.JSON(), nullable=False), sa.Column("fingerprint", sa.String(64), nullable=False),
                        sa.Column("status", sa.String(24), nullable=False), sa.Column("result", sa.JSON(), nullable=False),
                        sa.Column("updated_at", sa.DateTime(), nullable=False)]
        else:
            columns += [sa.Column("resource", sa.String(100), nullable=False), sa.Column("question", sa.Text(), nullable=False),
                        sa.Column("enabled", sa.Boolean(), nullable=False), sa.Column("interval_minutes", sa.Integer(), nullable=False),
                        sa.Column("allowed_actions", sa.JSON(), nullable=False), sa.Column("next_run_at", sa.DateTime(), nullable=False)]
        columns += [sa.Column("created_at", sa.DateTime(), nullable=False)]
        op.create_table(table, *columns)
        for field in ("organization_id", "owner_id"):
            op.create_index(f"ix_{table}_{field}", table, [field])
    for table, fields in {"module_ai_jobs": ["status"], "module_ai_operations": ["job_id", "status", "fingerprint"], "module_ai_automations": ["next_run_at"]}.items():
        for field in fields:
            op.create_index(f"ix_{table}_{field}", table, [field])


def downgrade():
    for table in ("module_ai_operations", "module_ai_jobs", "module_ai_automations"):
        op.drop_table(table)
