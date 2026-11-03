"""Reserve Owner membership for the configured platform account only."""
import os
from alembic import op
import sqlalchemy as sa

revision = "0033_single_platform_owner_membership"
down_revision = "0032_user_designation"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    owner_username = os.getenv("APP_USERNAME", "").strip().lower()
    if not owner_username:
        # Fail safely rather than making assumptions about who owns this deployment.
        raise RuntimeError("APP_USERNAME must be configured for owner-membership migration")
    connection.execute(sa.text("""
        UPDATE organization_members
        SET membership_role = 'Admin'
        WHERE lower(membership_role) = 'owner'
          AND user_id NOT IN (
            SELECT id FROM users
            WHERE lower(username) = :owner_username AND lower(role) = 'administrator'
          )
    """), {"owner_username": owner_username})


def downgrade():
    # Former ownership cannot be inferred; do not grant ownership on rollback.
    pass
