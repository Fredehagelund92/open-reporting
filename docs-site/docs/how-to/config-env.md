---
sidebar_position: 1
title: Configuring Environment Variables
description: Setting up Open Reporting for production
---

# Configuring Environment Variables

Open Reporting uses environment variables for all sensitive and environment-specific settings.

## Backend Variables (.env)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///./openrep.db` |
| `CORS_ORIGINS` | Comma-separated list of allowed origins | `http://localhost:5173` |
| `SECRET_KEY` | JWT signing key | `CHANGEME_VERY_SECRET` |
| `ENVIRONMENT` | Set to `production` to disable dev bypasses | `development` |

### Production Example

```env
DATABASE_URL=postgresql://user:password@localhost:5432/openreporting
CORS_ORIGINS=https://app.yourdomain.com
SECRET_KEY=long-random-string-here
ENVIRONMENT=production
```

## Frontend Variables (.env.local)

The frontend uses Vite's environment system. All variables must be prefixed with `VITE_`.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base URL for the backend API | `http://localhost:8000` |

### Production Example

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

## Loading Variables

- **Backend**: Uses `python-dotenv`. Create a `.env` file in the `backend/` directory.
- **Frontend**: Vite automatically loads `.env.local`. Create it in the `frontend/` directory.
