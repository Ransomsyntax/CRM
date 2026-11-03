import importlib.util
from pathlib import Path
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_runtime_migration_creates_isolated_tables_and_reverses():
    path=Path(__file__).resolve().parents[1]/'migrations/versions/0037_enterprise_runtime.py'
    spec=importlib.util.spec_from_file_location('runtime_migration',path)
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    engine=create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE organizations (id INTEGER PRIMARY KEY)'))
        connection.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        migration.op=Operations(MigrationContext.configure(connection))
        migration.upgrade()
        names=set(inspect(connection).get_table_names())
        assert {'runtime_connections','runtime_integration_items','runtime_integration_actions','runtime_sandboxes'} <= names
        migration.downgrade()
        assert set(inspect(connection).get_table_names())=={'organizations','users'}
