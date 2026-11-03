"""Add authenticated user's profile photo."""

from alembic import op
import sqlalchemy as sa

revision = "0030_user_profile_photo"
down_revision = "0029_sales_record_numbering"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("avatar_data", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("users", "avatar_data")
