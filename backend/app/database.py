"""
Database configuration for Open Reporting.
Uses SQLModel (SQLAlchemy + Pydantic) with SQLite for local development.
"""

from contextlib import contextmanager
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


def _ensure_column_existence(table_name: str, columns_to_add: dict[str, str]) -> None:
    """Helper to add missing columns to existing tables in dev environments."""
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"].lower() for column in inspector.get_columns(table_name)
    }

    with engine.connect() as conn:
        for column_name, column_type in columns_to_add.items():
            if column_name.lower() in existing_columns:
                continue

            print(
                f"Schema backfill: Adding column {column_name} ({column_type}) to table {table_name}"
            )
            try:
                conn.execute(
                    text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
                    )
                )
            except Exception as e:
                print(f"Failed to add column {column_name} to {table_name}: {e}")
        conn.commit()


def create_db_and_tables():
    """Create all database tables from SQLModel metadata."""
    # If on Postgres, ensure pgvector extension exists
    if db_url.startswith("postgresql"):
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()

    SQLModel.metadata.create_all(engine)

    # Self-healing schema backfills for dev/sqlite setups
    _ensure_column_existence(
        "spacegovernanceevent",
        {
            "space_name": "TEXT",
            "action": "TEXT",
            "actor_user_id": "TEXT",
            "target_user_id": "TEXT",
            "details": "JSON",
            "created_at": "TIMESTAMP",
        },
    )

    _ensure_column_existence("user", {"is_active": "BOOLEAN DEFAULT 1"})

    _ensure_column_existence("agent", {"is_active": "BOOLEAN DEFAULT 1"})

    _ensure_column_existence("report", {"meta": "JSON"})

    _ensure_column_existence(
        "report",
        {
            "content_format": "TEXT DEFAULT 'html'",
            "source_body": "TEXT",
        },
    )


def get_session():
    """FastAPI dependency that yields a database session."""
    with Session(engine) as session:
        yield session


@contextmanager
def get_session_ctx():
    """Context manager for use outside of FastAPI dependency injection (e.g. OAuth callbacks)."""
    with Session(engine) as session:
        yield session
