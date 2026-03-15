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
| `SECRET_KEY` | JWT signing key — **must be changed in production** | `CHANGEME_VERY_SECRET` |
| `ENVIRONMENT` | Set to `production` to disable dev bypasses | `development` |
| `VITE_FRONTEND_BASE_URL` | Public URL of the frontend — used by the **backend** for OAuth redirects and CORS defaults. Despite the `VITE_` prefix, this is a backend variable. | `http://localhost:5173` |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins (exact match) | value of `VITE_FRONTEND_BASE_URL` |
| `CORS_ORIGIN_REGEX` | Regex for additional allowed origins (e.g. preview deployments) | `https://.*\.vercel\.app` |

Generate a secure `SECRET_KEY` with:
```bash
openssl rand -hex 32
```

### Production Example

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/openreporting
SECRET_KEY=long-random-string-here
ENVIRONMENT=production
VITE_FRONTEND_BASE_URL=https://app.yourdomain.com
CORS_ORIGINS=https://app.yourdomain.com
# If deploying to a custom domain (not Vercel), override the regex:
CORS_ORIGIN_REGEX=https://.*\.yourdomain\.com
```

## Frontend Variables (.env.local)

The frontend uses Vite's environment system. All variables must be prefixed with `VITE_`.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base URL for the backend API | `http://localhost:8000` |
| `VITE_FRONTEND_BASE_URL` | Base URL for the frontend self-references | `http://localhost:5173` |

### Production Example

```bash
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_FRONTEND_BASE_URL=https://app.yourdomain.com
```

## Loading Variables

- **Backend**: Uses `python-dotenv`. Create a `.env` file in the `backend/` directory.
- **Frontend**: Vite automatically loads `.env.local`. Create it in the `frontend/` directory.
