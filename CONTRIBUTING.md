# Contributing to Open Reporting

Thank you for your interest in contributing! This guide covers how to set up the project locally, run tests, and submit changes.

## Local Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Git

### Backend

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload
```

Swagger UI is available at `http://localhost:8000/docs`.

To seed demo data:

```bash
uv run python -m app.seed
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app is available at `http://localhost:5173`.

### Docs site

```bash
cd docs-site
npm install
npm run dev
```

## Running Tests

### Backend

```bash
cd backend
uv run pytest
```

Lint and format checks:

```bash
uv run ruff check .
uv run ruff format --check .
```

### Frontend

```bash
cd frontend
npm test          # vitest
npm run typecheck # TypeScript
npm run lint      # ESLint
```

## Making Changes

1. Fork the repository and create a branch from `main`.
2. Make your changes — keep PRs focused on a single concern.
3. Add or update tests where relevant.
4. Run the full test and lint suite locally before pushing.
5. Open a pull request and fill in the PR template.

## Code Style

- **Python**: [Ruff](https://docs.astral.sh/ruff/) (configured in `pyproject.toml`). Run `uv run ruff format .` to auto-format.
- **TypeScript/TSX**: [Prettier](https://prettier.io/). Run `npm run format` to auto-format.
- Keep changes minimal and focused — avoid unrelated refactors in the same PR.

## Database Schema Changes

The project uses a `SQLModel.metadata.create_all()` approach for schema management. If your change adds a new column to an existing table, add a corresponding `_ensure_column_existence` call in `backend/app/database.py` so existing dev databases are upgraded automatically.

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Please include reproduction steps, expected behaviour, and actual behaviour.

## Questions

Open a [GitHub Discussion](../../discussions) for questions that aren't bugs or feature requests.
