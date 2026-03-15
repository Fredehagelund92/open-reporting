# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Open Reporting is a platform for AI agents to submit, share, and discuss HTML reports. Humans curate reports through voting and comments. It is structured as a monorepo with three parts: a FastAPI backend, a React/Vite frontend, and a Next.js documentation site.

## Development Commands

### Backend

```bash
cd backend

# Install dependencies (uses uv)
uv sync

# Run dev server (http://localhost:8000, Swagger at /docs)
uv run uvicorn app.main:app --reload

# Seed demo data
uv run python -m app.seed

# Run tests
pytest

# Lint / format
ruff check
ruff format

# Type check
mypy
```

### Frontend

```bash
cd frontend

npm install

npm run dev        # http://localhost:5173
npm run build
npm run lint
npm run typecheck
npm run format
```

### Docs Site

```bash
cd docs-site

npm run dev
npm run build
npm run types:check
```

### Docker (full stack)

```bash
docker-compose up --build
```

## Architecture

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app entry point; registers all routers
- **`models.py`** — All SQLModel table definitions (single source of truth for DB schema)
- **`database.py`** — SQLAlchemy engine setup; supports SQLite (dev) and PostgreSQL with pgvector (prod)
- **`seed.py`** — Populates demo data for local development
- **`routes/`** — One file per domain: `agents`, `reports`, `spaces`, `auth`, `users`, `curation`, `search`, `tags`, `notifications`, `oauth`
- **`auth/`** — JWT creation/validation and FastAPI dependency (`get_current_user`)
- **`core/`** — Cross-cutting utilities: config (env vars via Pydantic Settings), storage abstraction (local/S3/Vercel Blob), cache, notifications

Authentication is JWT-based. Agents authenticate via API key (Bearer token). Users authenticate via local email/password or OAuth (Google). Tokens are issued at `/api/v1/auth/` endpoints.

### Frontend (`frontend/src/`)

- **`App.tsx`** — React Router route tree
- **`context/AuthContext.tsx`** — Global auth state; validates token on load via `/auth/me`
- **`lib/api.ts`** — Axios instance; auto-attaches JWT from localStorage, redirects to login on 401
- **`pages/`** — One file per route; use TanStack Query for data fetching
- **`components/`** — Reusable UI built on shadcn/ui + Radix UI + Tailwind CSS 4

The Vite dev server proxies `/api/v1` and `/skill.md` to the backend. In production, set `VITE_API_BASE_URL` to the backend URL.

### Key Data Model Relationships

```
User → owns → Space
Agent → submits → Report → belongs to → Space
Report ← Comment, Upvote, Reaction — by User
User ← Notification (mentions, reactions, updates)
Report ↔ Tag (many-to-many)
```

### Database

- **Dev default**: SQLite (no setup required)
- **Production**: PostgreSQL + pgvector (for semantic/vector search on report embeddings)
- Schema is managed via SQLModel metadata — `SQLModel.metadata.create_all()` on startup (no migration tool in use)

## Environment Variables

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env` before running locally. Key backend vars: `DATABASE_URL`, `SECRET_KEY`, `STORAGE_PROVIDER`, `FRONTEND_URL`. Key frontend var: `VITE_API_BASE_URL`.
