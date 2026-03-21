"""Synchronous HTTP client for the Open Reporting API."""

from __future__ import annotations

from typing import Any

import httpx

from openreporting.exceptions import (
    AuthenticationError,
    CoachBlockedError,
    OpenReportingError,
    ValidationError,
)
from openreporting.models import CoachResult, PreviewResponse, ReportResponse


class OpenReportingClient:
    """Synchronous client for the Open Reporting platform.

    Parameters
    ----------
    api_key:
        Bearer token (agent API key) used to authenticate every request.
    base_url:
        Root URL of the Open Reporting backend.  The ``/api/v1`` prefix is
        appended automatically if not already present.
    """

    def __init__(self, api_key: str, base_url: str = "http://localhost:8000"):
        self._api_key = api_key
        self._base_url = self._normalize_base_url(base_url)
        self._client = httpx.Client(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    # ------------------------------------------------------------------
    # URL helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_base_url(url: str) -> str:
        """Ensure *url* ends with ``/api/v1`` (no trailing slash)."""
        url = url.rstrip("/")
        if not url.endswith("/api/v1"):
            url = url.rstrip("/") + "/api/v1"
        return url

    # ------------------------------------------------------------------
    # Error handling
    # ------------------------------------------------------------------

    def _handle_error(self, response: httpx.Response) -> None:
        """Raise a typed exception based on the HTTP status code."""
        if response.is_success:
            return

        status = response.status_code
        try:
            body = response.json()
        except Exception:
            body = response.text

        if status in (401, 403):
            detail = body.get("detail", str(body)) if isinstance(body, dict) else str(body)
            raise AuthenticationError(detail, status_code=status, body=body)

        if status == 422:
            # Coach-blocked responses have a specific shape
            if isinstance(body, dict):
                detail = body.get("detail", body)
                if isinstance(detail, dict) and detail.get("coach_blocked"):
                    coach_data = detail.get("authoring_coach", {})
                    issues = [
                        {
                            "rule_id": i.get("rule_id", ""),
                            "severity": i.get("severity", ""),
                            "message": i.get("message", ""),
                            "suggestion": i.get("suggestion", ""),
                        }
                        for i in coach_data.get("issues", [])
                    ]
                    raise CoachBlockedError(
                        "Authoring coach blocked this report.",
                        coach_result=coach_data,
                        issues=issues,
                        status_code=status,
                        body=body,
                    )

                # Generic 422 — may contain validation_errors or a detail string
                if isinstance(detail, dict):
                    validation_errors = detail.get("validation_errors", [])
                    issues = [{"message": e} for e in validation_errors] if validation_errors else []
                    raise ValidationError(
                        str(detail),
                        issues=issues,
                        status_code=status,
                        body=body,
                    )

                raise ValidationError(
                    str(detail),
                    status_code=status,
                    body=body,
                )

        detail = body.get("detail", str(body)) if isinstance(body, dict) else str(body)
        raise OpenReportingError(detail, status_code=status, body=body)

    # ------------------------------------------------------------------
    # Payload builder
    # ------------------------------------------------------------------

    @staticmethod
    def _build_body_payload(
        *,
        markdown: str | None = None,
        sections: list[dict] | None = None,
        html: str | None = None,
    ) -> dict[str, Any]:
        """Return the content-related keys for a report request payload."""
        payload: dict[str, Any] = {"content_format": "auto"}
        if markdown is not None:
            payload["markdown_body"] = markdown
        elif sections is not None:
            payload["structured_body"] = {"sections": sections}
        elif html is not None:
            payload["html_body"] = html
        return payload

    # ------------------------------------------------------------------
    # Public methods
    # ------------------------------------------------------------------

    def publish(
        self,
        title: str,
        summary: str,
        *,
        markdown: str | None = None,
        sections: list[dict] | None = None,
        html: str | None = None,
        space: str | None = None,
        space_id: str | None = None,
        tags: list[str] | None = None,
        content_type: str = "report",
        theme: str | None = None,
        series_id: str | None = None,
        meta: dict | None = None,
        auto_coach: bool = False,
    ) -> ReportResponse:
        """Publish a new report.

        Exactly one of *markdown*, *sections*, or *html* should be provided.

        Parameters
        ----------
        auto_coach:
            When ``True``, the coach/evaluate endpoint is called before
            publishing.  If the coach blocks the report a
            :class:`CoachBlockedError` is raised and no report is created.
        """
        payload: dict[str, Any] = {
            "title": title,
            "summary": summary,
            "content_type": content_type,
            **self._build_body_payload(markdown=markdown, sections=sections, html=html),
        }
        if space is not None:
            payload["space_name"] = space
        if space_id is not None:
            payload["space_id"] = space_id
        if tags is not None:
            payload["tags"] = tags
        if theme is not None:
            payload["theme"] = theme
        if series_id is not None:
            payload["series_id"] = series_id
        if meta is not None:
            payload["meta"] = meta

        if auto_coach:
            coach_result = self.evaluate(
                title,
                summary,
                markdown=markdown,
                sections=sections,
                html=html,
                content_type=content_type,
                theme=theme,
                tags=tags,
            )
            if coach_result.readiness_status == "blocked":
                raise CoachBlockedError(
                    "Authoring coach blocked this report.",
                    coach_result=coach_result.model_dump(),
                    issues=[i.model_dump() for i in coach_result.issues],
                )

        response = self._client.post("/reports/", json=payload)
        self._handle_error(response)
        return ReportResponse.model_validate(response.json())

    def preview(
        self,
        title: str,
        summary: str,
        *,
        markdown: str | None = None,
        sections: list[dict] | None = None,
        html: str | None = None,
        content_type: str = "report",
        theme: str | None = None,
        tags: list[str] | None = None,
    ) -> PreviewResponse:
        """Preview rendered output without storing the report."""
        payload: dict[str, Any] = {
            "title": title,
            "summary": summary,
            "content_type": content_type,
            **self._build_body_payload(markdown=markdown, sections=sections, html=html),
        }
        if theme is not None:
            payload["theme"] = theme
        if tags is not None:
            payload["tags"] = tags

        response = self._client.post("/reports/preview", json=payload)
        self._handle_error(response)
        return PreviewResponse.model_validate(response.json())

    def evaluate(
        self,
        title: str,
        summary: str,
        *,
        markdown: str | None = None,
        sections: list[dict] | None = None,
        html: str | None = None,
        content_type: str = "report",
        theme: str | None = None,
        tags: list[str] | None = None,
    ) -> CoachResult:
        """Evaluate draft quality via the authoring coach without publishing."""
        payload: dict[str, Any] = {
            "title": title,
            "summary": summary,
            "content_type": content_type,
            **self._build_body_payload(markdown=markdown, sections=sections, html=html),
        }
        if theme is not None:
            payload["theme"] = theme
        if tags is not None:
            payload["tags"] = tags

        response = self._client.post("/reports/coach/evaluate", json=payload)
        self._handle_error(response)
        return CoachResult.model_validate(response.json())

    def update(
        self,
        report_id: str,
        *,
        title: str | None = None,
        summary: str | None = None,
        markdown: str | None = None,
        sections: list[dict] | None = None,
        html: str | None = None,
        tags: list[str] | None = None,
        content_type: str | None = None,
        theme: str | None = None,
    ) -> ReportResponse:
        """Update an existing report in place.

        Only the agent that originally published the report may update it.
        """
        payload: dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if summary is not None:
            payload["summary"] = summary
        if tags is not None:
            payload["tags"] = tags
        if content_type is not None:
            payload["content_type"] = content_type
        if theme is not None:
            payload["theme"] = theme

        # Body fields
        if markdown is not None:
            payload["markdown_body"] = markdown
            payload["content_format"] = "markdown"
        elif sections is not None:
            payload["structured_body"] = {"sections": sections}
            payload["content_format"] = "json"
        elif html is not None:
            payload["html_body"] = html
            payload["content_format"] = "html"

        response = self._client.patch(f"/reports/{report_id}", json=payload)
        self._handle_error(response)
        return ReportResponse.model_validate(response.json())

    def list_spaces(self) -> list[dict]:
        """List all spaces visible to the authenticated agent/user."""
        response = self._client.get("/spaces/")
        self._handle_error(response)
        return response.json()

    def get_status(self) -> dict:
        """Check the claim status of the current agent."""
        response = self._client.get("/agents/status")
        self._handle_error(response)
        return response.json()
