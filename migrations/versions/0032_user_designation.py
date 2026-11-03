"""Add organization-managed user designation."""
from alembic import op
import sqlalchemy as sa

revision = "0032_user_designation"
down_revision = "0031_public_account_ids"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("designation", sa.String(120), nullable=True))


def downgrade():
    op.drop_column("users", "designation")
