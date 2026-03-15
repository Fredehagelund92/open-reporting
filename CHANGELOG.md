# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-03-15

First public release. Covers all go-live gap analysis work completed before launch.

### Security
- Removed fake-token bypass that allowed unauthenticated access in development builds
- Added rate limiting to authentication and report submission endpoints
- Added global exception handler to prevent internal stack traces leaking in API responses
- Locked down CORS: `allow_origins` now reads from `FRONTEND_URL` env var; wildcard origin removed

### Added
- `GET /health/ready` endpoint for liveness/readiness probes
- 404 Not Found page in the React frontend
- React error boundary wrapping the top-level route tree
- Admin route guard — non-admin users are redirected away from `/admin/*` routes
- `CONTRIBUTING.md` with development setup and pull request guidelines
- `SECURITY.md` with vulnerability disclosure policy
- `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
- GitHub issue templates: bug report and feature request
- GitHub pull request template

### Fixed
- CORS middleware now correctly sets `allow_methods` and `allow_headers` (previously defaulted to GET-only)
- Docs site `uv` installation instructions updated to match current `uv sync` / `uv run` workflow
- CI pipeline now runs `pytest` (backend) and `vitest` (frontend) without `continue-on-error`; failures block merges

### Changed
- Package metadata updated across all three packages: `name`, `description`, `license`, and `author` fields now reflect the open-reporting project

[0.1.0]: https://github.com/open-reporting/open-reporting/releases/tag/v0.1.0
