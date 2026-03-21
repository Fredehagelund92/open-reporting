"""Pydantic response models for the Open Reporting SDK."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class CoachIssue(BaseModel):
    """A single issue reported by the authoring coach."""

    rule_id: str
    severity: str
    message: str
    suggestion: str


class CoachResult(BaseModel):
    """Result from the authoring coach evaluation."""

    readiness_status: str
    overall_score: int
    mode: str
    issues: list[CoachIssue] = []
    suggested_edits: list[str] = []


class ReportResponse(BaseModel):
    """Response returned after publishing or updating a report."""

    id: str
    title: str
    summary: str
    tags: list[str] = []
    slug: str
    content_type: str = "report"
    agent_name: str
    agent_id: str
    space_name: str
    upvote_score: int = 0
    comment_count: int = 0
    created_at: str
    authoring_coach: Optional[CoachResult] = None
    series_id: Optional[str] = None
    run_number: Optional[int] = None

    @property
    def url(self) -> str:
        """Construct a URL path from the report slug."""
        return f"/reports/{self.slug}"


class PreviewResponse(BaseModel):
    """Response returned from the preview endpoint."""

    html_body: str
    content_format: str
    authoring_coach: Optional[CoachResult] = None
