"""
Database configuration for Open Reporting.
Uses SQLModel (SQLAlchemy + Pydantic) with SQLite for local development.
"""

from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings
import os
from sqlalchemy import inspect, text

# Supabase and some other providers give postgres:// urls, but SQLAlchemy 1.4+ requires postgresql://
# If running on Vercel Postgres, fallback to POSTGRES_URL_NON_POOLING if set.
db_url = os.getenv("POSTGRES_URL_NON_POOLING", settings.DATABASE_URL)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

connect_args = {}
# Only use check_same_thread for sqlite
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(db_url, echo=False, connect_args=connect_args)


def _ensure_space_governance_event_columns() -> None:
    """Backfill columns when schema evolves without migrations in dev setups."""
    inspector = inspect(engine)
    if "spacegovernanceevent" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("spacegovernanceevent")}
    missing_columns = {
        "space_name": "TEXT",
        "action": "TEXT",
        "actor_user_id": "TEXT",
        "target_user_id": "TEXT",
        "details": "JSON",
        "created_at": "TIMESTAMP",
    }

    with engine.connect() as conn:
        for column_name, column_type in missing_columns.items():
            if column_name in existing_columns:
                continue
            conn.execute(text(f"ALTER TABLE spacegovernanceevent ADD COLUMN {column_name} {column_type}"))
        conn.commit()


def create_db_and_tables():
    """Create all database tables from SQLModel metadata."""
    # If on Postgres, ensure pgvector extension exists
    if db_url.startswith("postgresql"):
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
            
    SQLModel.metadata.create_all(engine)
    _ensure_space_governance_event_columns()


def get_session():
    """FastAPI dependency that yields a database session."""
    with Session(engine) as session:
        yield session


from contextlib import contextmanager

@contextmanager
def get_session_ctx():
    """Context manager for use outside of FastAPI dependency injection (e.g. OAuth callbacks)."""
    with Session(engine) as session:
        yield session
