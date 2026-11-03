"""Public identifiers must be sequential, unique, and independent of FK primary keys."""
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.models import Base, User, Organization


def test_public_ids_and_owner_reservations(monkeypatch):
    monkeypatch.setenv("APP_USERNAME", "crm.owner")
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(name="CRM Owner", email="owner@example.test",
                     username="crm.owner", role="Administrator")
        db.add(owner)
        db.flush()
        assert owner.public_id == 777
        owner_org = Organization(name="Owner", slug="owner", owner_user_id=owner.id)
        db.add(owner_org)
        db.flush()
        assert owner_org.public_id == 7001

        users = [
            User(name="First", email="first@example.test", username="first"),
            User(name="Second", email="second@example.test", username="second"),
        ]
        for user in users:
            db.add(user)
            db.flush()
        assert [u.public_id for u in users] == [778, 779]

        orgs = [
            Organization(name="First", slug="first-org", owner_user_id=users[0].id),
            Organization(name="Second", slug="second-org", owner_user_id=users[1].id),
        ]
        for org in orgs:
            db.add(org)
            db.flush()
        assert [org.public_id for org in orgs] == [7002, 7003]
        assert len({u.public_id for u in [owner, *users]}) == 3
        assert len({org.public_id for org in [owner_org, *orgs]}) == 3
        db.commit()
        assert db.scalar(select(User).where(User.public_id == 777)).id == owner.id


def test_one_flush_allocates_distinct_ids_for_multiple_users_and_organizations(monkeypatch):
    """SQLAlchemy normally runs all before_insert hooks before any batched INSERT."""
    monkeypatch.setenv("APP_USERNAME", "batch.owner")
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        users = [User(name="Owner", email="batch-owner@example.test", username="batch.owner", role="Administrator"),
                 User(name="First", email="batch-first@example.test"),
                 User(name="Second", email="batch-second@example.test")]
        db.add_all(users)
        db.flush()
        assert [user.public_id for user in users] == [777, 778, 779]
        orgs = [Organization(name=f"Batch {i}", slug=f"batch-{i}", owner_user_id=user.id)
                for i, user in enumerate(users)]
        db.add_all(orgs)
        db.commit()
        assert [org.public_id for org in orgs] == [7001, 7002, 7003]
