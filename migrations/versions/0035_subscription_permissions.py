"""Purchased seats and invitation permission assignments."""
from alembic import op
import sqlalchemy as sa

revision = "0035_subscription_permissions"
down_revision = "0034_webform_tracking"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("subscription_change_requests", sa.Column("requested_seats", sa.Integer(), nullable=True))
    op.add_column("organization_subscriptions", sa.Column("purchased_seats", sa.Integer(), nullable=False, server_default="3"))
    op.add_column("organization_invitations", sa.Column("profile_name", sa.String(120), nullable=True))
    op.add_column("organization_invitations", sa.Column("user_role", sa.String(80), nullable=True))
    # Preserve existing memberships when introducing purchased-seat enforcement.
    op.execute(sa.text("""UPDATE organization_subscriptions SET purchased_seats =
        CASE WHEN ((SELECT COUNT(*) FROM organization_members m WHERE
          m.organization_id = organization_subscriptions.organization_id AND m.status = 'Active') +
          (SELECT COUNT(*) FROM organization_invitations i WHERE
          i.organization_id = organization_subscriptions.organization_id AND i.status = 'Pending'
          AND i.expires_at > CURRENT_TIMESTAMP)) > 3
        THEN ((SELECT COUNT(*) FROM organization_members m WHERE
          m.organization_id = organization_subscriptions.organization_id AND m.status = 'Active') +
          (SELECT COUNT(*) FROM organization_invitations i WHERE
          i.organization_id = organization_subscriptions.organization_id AND i.status = 'Pending'
          AND i.expires_at > CURRENT_TIMESTAMP)) ELSE 3 END"""))


def downgrade():
    op.drop_column("subscription_change_requests", "requested_seats")
    op.drop_column("organization_invitations", "user_role")
    op.drop_column("organization_invitations", "profile_name")
    op.drop_column("organization_subscriptions", "purchased_seats")
