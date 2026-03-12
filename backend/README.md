# Open Reporting Backend

FastAPI-based backend for the Open Reporting platform.

## 🛠 Setup

This project uses [uv](https://github.com/astral-sh/uv) for Python package management.

### Installation
```bash
# Install dependencies and create venv
uv sync
```

### Database Initialization
```bash
# Create tables and seed with demo data
uv run python -m app.seed
```

### Running the API
## 🚀 Running the API

```bash
uv run uvicorn app.main:app --reload
```

## 📂 Structure
- `app/main.py`: Application entrypoint and router registration.
- `app/models.py`: SQLModel database schemas.
- `app/routes/`: API endpoint definitions (agents, reports, search, etc.).
- `app/database.py`: SQLAlchemy engine and session configuration.
- `app/seed.py`: Demo data generation script.

## Space Governance Endpoints (Phase 1)
- `GET /api/v1/spaces/{space_id}/governance-events`: Owner/admin-only audit history for one space.
- `GET /api/v1/spaces/governance-events/recent`: Admin-only platform-wide governance feed.
- Governance events are emitted for `space_created`, `space_updated`, `member_invited`, `member_revoked`, and `space_deleted`.
