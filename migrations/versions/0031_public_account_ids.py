"""Unique sequential public IDs, retaining existing relational primary keys."""
from __future__ import annotations

import os

from alembic import op
import sqlalchemy as sa

revision = "0031_public_account_ids"
down_revision = "0030_user_profile_photo"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("public_id", sa.Integer(), nullable=True))
    op.add_column("organizations", sa.Column("public_id", sa.Integer(), nullable=True))
    db = op.get_bind()
    owner_name = os.getenv("APP_USERNAME", "").strip().lower()
    owner_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    owner = None
    if owner_name:
        owner = db.execute(sa.text(
            "SELECT id FROM users WHERE LOWER(username) = :name ORDER BY id LIMIT 1"
        ), {"name": owner_name}).scalar_one_or_none()
    if owner is None and owner_email:
        owner = db.execute(sa.text(
            "SELECT id FROM users WHERE LOWER(email) = :email ORDER BY id LIMIT 1"
        ), {"email": owner_email}).scalar_one_or_none()
    if owner is None:
        owner = db.execute(sa.text(
            "SELECT id FROM users WHERE role = 'Administrator' ORDER BY id LIMIT 1"
        )).scalar_one_or_none()

    if owner is not None:
        db.execute(sa.text("UPDATE users SET public_id = 777 WHERE id = :id"), {"id": owner})
    next_user = 777
    for row in db.execute(sa.text("SELECT id FROM users WHERE public_id IS NULL ORDER BY id")).mappings():
        next_user += 1
        db.execute(sa.text("UPDATE users SET public_id = :number WHERE id = :id"),
                   {"number": next_user, "id": row["id"]})

    owner_org = None
    if owner is not None:
        owner_org = db.execute(sa.text(
            "SELECT id FROM organizations WHERE owner_user_id = :id ORDER BY id LIMIT 1"
        ), {"id": owner}).scalar_one_or_none()
    if owner_org is not None:
        db.execute(sa.text("UPDATE organizations SET public_id = 7001 WHERE id = :id"),
                   {"id": owner_org})
    next_org = 7001
    for row in db.execute(sa.text(
        "SELECT id FROM organizations WHERE public_id IS NULL ORDER BY id"
    )).mappings():
        next_org += 1
        db.execute(sa.text("UPDATE organizations SET public_id = :number WHERE id = :id"),
                   {"number": next_org, "id": row["id"]})
    with op.batch_alter_table("users") as batch:
        batch.alter_column("public_id", nullable=False)
        batch.create_unique_constraint("uq_users_public_id", ["public_id"])
    with op.batch_alter_table("organizations") as batch:
        batch.alter_column("public_id", nullable=False)
        batch.create_unique_constraint("uq_organizations_public_id", ["public_id"])


def downgrade():
    with op.batch_alter_table("organizations") as batch:
        batch.drop_constraint("uq_organizations_public_id", type_="unique")
        batch.drop_column("public_id")
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("uq_users_public_id", type_="unique")
        batch.drop_column("public_id")
