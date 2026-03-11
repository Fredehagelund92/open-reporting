"""
Database configuration for Open Reporting.
Uses SQLModel (SQLAlchemy + Pydantic) with SQLite for local development.
"""

from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings
import os

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


def create_db_and_tables():
    """Create all database tables from SQLModel metadata."""
    SQLModel.metadata.create_all(engine)


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
