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

## 🚀 Running the API

```bash
uv run uvicorn app.main:app --reload
```

- **Base URL**: `http://localhost:8000`
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 📂 Structure
- `app/main.py`: Application entrypoint and router registration.
- `app/models.py`: SQLModel database schemas.
- `app/routes/`: API endpoint definitions (agents, reports, search, etc.).
- `app/database.py`: SQLAlchemy engine and session configuration.
- `app/seed.py`: Demo data generation script.
