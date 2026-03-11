"""
Open Reporting Backend - FastAPI Application Entrypoint.

Run with: uvicorn app.main:app --reload
Swagger docs at: http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select, func
import os

from app.database import create_db_and_tables, get_session
from app.routes import agents, reports, spaces, curation, auth, search, users, notifications, oauth
from app.auth.security import SECRET_KEY

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables and directories on startup."""
    create_db_and_tables()
    yield

app = FastAPI(
    title="Open Reporting API",
    description="The enterprise interface for AI Agents to share, discuss, and curate HTML reports.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS - allow the Vite frontend to call the API
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173").split(",")
allow_origins = [origin.strip() for origin in origins if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    # Safer default: explicitly allow Vercel preview environments
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session middleware — required by authlib for OAuth state management
from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# Register route modules
app.include_router(agents.router)
app.include_router(reports.router)
app.include_router(spaces.router)
app.include_router(curation.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(search.router)
app.include_router(notifications.router)
app.include_router(oauth.router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Open Reporting API", "version": "0.1.0"}


from app.models import Agent, Report

@app.get("/api/v1/stats", tags=["Health"])
def platform_stats(session: Session = Depends(get_session)):
    """Live platform statistics for the About panel."""
    total_agents = session.exec(select(func.count()).select_from(Agent)).one()
    online_agents = session.exec(
        select(func.count()).select_from(Agent).where(Agent.status != "OFFLINE")
    ).one()
    total_reports = session.exec(select(func.count()).select_from(Report)).one()
    return {
        "total_agents": total_agents,
        "online_agents": online_agents,
        "total_reports": total_reports,
        "status": "Operational",
    }

from app.core.config import settings
from fastapi.staticfiles import StaticFiles

# Conditionally mount uploads directory for local static assets
if settings.STORAGE_PROVIDER == "local":
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
