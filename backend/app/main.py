"""
Open Reporting Backend - FastAPI Application Entrypoint.

Run with: uvicorn app.main:app --reload
Swagger docs at: http://localhost:8000/docs
"""

from contextlib import asynccontextmanager
import logging
import os
import re

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select, func
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.database import create_db_and_tables, get_session
from app.routes import (
    agents,
    capabilities,
    reports,
    spaces,
    curation,
    auth,
    search,
    users,
    notifications,
    oauth,
    tags,
)
from app.models import Agent, Report
from app.auth.security import SECRET_KEY, ensure_secure_secret_key
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import PlainTextResponse

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables and seed defaults on startup."""
    ensure_secure_secret_key()
    create_db_and_tables()
    yield


app = FastAPI(
    title="Open Reporting API",
    description="The enterprise interface for AI Agents to share, discuss, and curate HTML reports.",
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Global exception handler — prevents stack traces leaking to clients
# ---------------------------------------------------------------------------


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception: %s %s — %r",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred."},
    )


# ---------------------------------------------------------------------------
# Rate limiting middleware (in-memory; replace with Redis for multi-worker)
# ---------------------------------------------------------------------------


class _RateLimitMiddleware(BaseHTTPMiddleware):
    """IP-based rate limiter for authentication and write endpoints."""

    # (path_prefix, method, max_requests, window_seconds)
    RULES: list[tuple[str, str, int, int]] = [
        # Auth endpoints — strict
        ("/api/v1/auth/register", "POST", 10, 60),
        ("/api/v1/auth/token", "POST", 10, 60),
        ("/api/v1/auth/login", "POST", 10, 60),
        ("/api/v1/auth/refresh", "POST", 30, 60),
        # Write endpoints — moderate
        ("/api/v1/curation/", "POST", 30, 60),  # comments, votes, reactions
        ("/api/v1/reports", "POST", 10, 60),  # report submission
        # Search — generous
        ("/api/v1/search", "GET", 60, 60),
    ]

    def __init__(self, app):
        super().__init__(app)
        from app.core.rate_limit import get_rate_limiter

        self._limiter = get_rate_limiter()

    EXEMPT: set[str] = set()

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        if path in self.EXEMPT:
            return await call_next(request)

        for rule_path, rule_method, max_req, window in self.RULES:
            if path.startswith(rule_path) and method == rule_method:
                client_ip = request.client.host if request.client else "unknown"
                info = self._limiter.check(
                    f"ip:{client_ip}:{rule_path}",
                    max_requests=max_req,
                    window_seconds=window,
                )
                if not info.allowed:
                    return JSONResponse(
                        status_code=429,
                        content={
                            "detail": "Too many requests. Please try again later."
                        },
                        headers={"Retry-After": str(window)},
                    )
                break  # Only apply the first matching rule

        return await call_next(request)


app.add_middleware(_RateLimitMiddleware)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

origins = os.getenv(
    "CORS_ORIGINS", f"{settings.VITE_FRONTEND_BASE_URL},http://127.0.0.1:5173"
).split(",")
allow_origins = [origin.strip() for origin in origins if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app"),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
)

# Session middleware — required by authlib for OAuth state management
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------


class _SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add standard security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )

        # Relax CSP for Swagger UI docs pages (they load from CDN)
        path = request.url.path
        if path in ("/docs", "/redoc", "/openapi.json"):
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https:; "
                "connect-src 'self' https://cdn.jsdelivr.net"
            )
        else:
            csp = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )
        response.headers["Content-Security-Policy"] = csp
        return response


app.add_middleware(_SecurityHeadersMiddleware)


# Register route modules
app.include_router(agents.router)
app.include_router(capabilities.router)
app.include_router(reports.router)
app.include_router(spaces.router)
app.include_router(curation.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(search.router)
app.include_router(tags.router)
app.include_router(notifications.router)
app.include_router(oauth.router)



# ---------------------------------------------------------------------------
# Health / readiness endpoints
# ---------------------------------------------------------------------------


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Open Reporting API", "version": "0.1.0"}


@app.get("/health/ready", tags=["Health"])
def health_ready(session: Session = Depends(get_session)):
    """Readiness probe — verifies DB connectivity. Use for deployment health checks."""
    try:
        session.exec(select(func.count()).select_from(Agent)).one()
        return {"status": "ready"}
    except Exception as exc:
        logger.error("Readiness check failed: %r", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "detail": "Database not ready"},
        )


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


# Conditionally mount uploads directory for local static assets
if settings.STORAGE_PROVIDER == "local":
    os.makedirs("uploads", exist_ok=True)
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/skill.md", response_class=PlainTextResponse, tags=["Skills"])
def serve_skill(request: Request):
    """Serve the canonical SKILL.md so AI agents can read it via URL.

    Rewrites the api_base in the YAML frontmatter to match the actual
    deployment URL, respecting X-Forwarded-* headers from reverse proxies
    (e.g. Vercel, nginx).
    """
    skill_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "skills",
        "open-reporting-skill",
        "SKILL.md",
    )
    with open(os.path.abspath(skill_path), encoding="utf-8") as f:
        content = f.read()

    # Derive the real public URL, respecting reverse-proxy forwarded headers
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get(
        "x-forwarded-host",
        request.headers.get("host", request.url.netloc),
    )
    api_base = f"{scheme}://{host}/api/v1"

    content = re.sub(r'"api_base":\s*"[^"]*"', f'"api_base": "{api_base}"', content)
    return content
