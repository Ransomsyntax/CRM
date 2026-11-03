"""Seat migration preserves existing accounts and pending invitations."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_migration_preserves_existing_seat_reservations():
    path=Path(__file__).resolve().parents[1]/'migrations/versions/0035_subscription_permissions.py'
    spec=importlib.util.spec_from_file_location('seat_migration',path)
    migration=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine=create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE organization_subscriptions (id INTEGER PRIMARY KEY, organization_id INTEGER)'))
        connection.execute(text('CREATE TABLE organization_members (id INTEGER PRIMARY KEY, organization_id INTEGER, status TEXT)'))
        connection.execute(text('CREATE TABLE organization_invitations (id INTEGER PRIMARY KEY, organization_id INTEGER, status TEXT, expires_at DATETIME)'))
        connection.execute(text('CREATE TABLE subscription_change_requests (id INTEGER PRIMARY KEY)'))
        connection.execute(text('INSERT INTO organization_subscriptions VALUES (1,1),(2,2)'))
        connection.execute(text("INSERT INTO organization_members VALUES (1,1,'Active'),(2,1,'Active'),(3,1,'Active'),(4,1,'Inactive')"))
        connection.execute(text("INSERT INTO organization_invitations VALUES (1,1,'Pending','2099-01-01'),(2,1,'Pending','2099-01-01'),(3,1,'Pending','2000-01-01')"))
        migration.op=Operations(MigrationContext.configure(connection))
        migration.upgrade()
        assert connection.execute(text('SELECT purchased_seats FROM organization_subscriptions ORDER BY id')).scalars().all()==[5,3]
        assert {'profile_name','user_role'} <= {column['name'] for column in inspect(connection).get_columns('organization_invitations')}
        assert 'requested_seats' in {column['name'] for column in inspect(connection).get_columns('subscription_change_requests')}
        migration.downgrade()
        assert connection.execute(text('SELECT COUNT(*) FROM organization_members')).scalar()==4
