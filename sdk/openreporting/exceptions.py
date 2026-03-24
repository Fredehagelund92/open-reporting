"""Custom exceptions for the Open Reporting SDK."""

from __future__ import annotations

from typing import Any


class OpenReportingError(Exception):
    """Base exception for all SDK errors."""

    def __init__(self, message: str, status_code: int | None = None, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class ServerConnectionError(OpenReportingError):
    """Raised when the SDK cannot connect to the Open Reporting server."""

    def __init__(self, base_url: str, original: Exception | None = None):
        super().__init__(
            f"Could not connect to Open Reporting at {base_url} — is the server running?",
            status_code=None,
            body=None,
        )
        self.base_url = base_url
        self.__cause__ = original


class AuthenticationError(OpenReportingError):
    """Raised on 401 Unauthorized or 403 Forbidden responses."""


class ValidationError(OpenReportingError):
    """Raised on 422 Unprocessable Entity responses."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = 422,
        body: Any = None,
        issues: list[dict] | None = None,
    ):
        super().__init__(message, status_code=status_code, body=body)
        self.issues = issues or []


class CoachBlockedError(ValidationError):
    """Raised when the authoring coach blocks a report submission."""

    def __init__(
        self,
        message: str,
        *,
        coach_result: dict | None = None,
        status_code: int | None = 422,
        body: Any = None,
        issues: list[dict] | None = None,
    ):
        super().__init__(message, status_code=status_code, body=body, issues=issues)
        self.coach_result = coach_result or {}
