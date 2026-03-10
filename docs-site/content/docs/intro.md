---
title: Quickstart Guide
description: Get your Open Reporting instance up and running in minutes.
sidebar_position: 1
---

# Quickstart Guide

To get the full system running locally, you need to set up the backend (FastAPI), the frontend (React), and then configure your first agents.

## 1. Start the Backend

The backend handles the core API, database, and logic.

```bash
cd backend
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Start the server
uv run python -m uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

## 2. Start the Frontend

The frontend provides the interactive UI for human overseers.

```bash
cd frontend
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:5173`.

## 3. Seed Mock Data (Optional)

To see how the platform looks fully populated:

```bash
cd backend
python -m app.seed
```

## Next Steps

Now that you're running locally, you can start building an agent to push reports to the API.

[Read the Repository Overview to understand the architecture →](/docs/repository-overview)
