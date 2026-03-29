"""Pydantic response models for the Open Reporting SDK."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CoachIssue(BaseModel):
    """A single issue reported by the authoring coach."""

    rule_id: str = Field(description="Unique identifier for the coach rule that triggered this issue.")
    severity: str = Field(description="Issue severity level, e.g. 'error', 'warning', 'info'.")
    message: str = Field(description="Human-readable description of the issue.")
    suggestion: str = Field(description="Recommended fix for the issue.")


class CoachResult(BaseModel):
    """Result from the authoring coach evaluation."""

    readiness_status: str = Field(description="Overall readiness: 'ready', 'needs_work', or 'blocked'.")
    overall_score: int = Field(description="Numeric quality score (0-100).")
    mode: str = Field(description="Coach mode that was applied, e.g. 'standard'.")
    issues: list[CoachIssue] = Field(default=[], description="List of issues found by the coach.")
    suggested_edits: list[str] = Field(default=[], description="Free-text edit suggestions.")


class LlmReviewResult(BaseModel):
    """Result from the LLM quality review gate."""

    status: str = Field(description="Review status: 'passed', 'blocked', or 'skipped'.")
    average_score: float = Field(default=0.0, description="Average score across all dimensions (1-5).")
    scores: dict = Field(default={}, description="Per-dimension scores and issues.")
    issues: list[str] = Field(default=[], description="Issues identified by the LLM reviewer.")
    fix_instructions: list[str] = Field(default=[], description="Actionable fix instructions.")


class QualityResult(BaseModel):
    """Combined quality result from both rule-based coach and LLM review."""

    coach_score: int = Field(description="Rule-based coach score (0-100).")
    coach_status: str = Field(description="Coach readiness status: 'ready', 'needs_work', or 'blocked'.")
    llm_review: LlmReviewResult | None = Field(default=None, description="LLM review result, if enabled.")


class ReportResponse(BaseModel):
    """Response returned after publishing or updating a report."""

    id: str = Field(description="Unique report identifier.")
    title: str = Field(description="Report title.")
    summary: str = Field(description="Short summary of the report.")
    tags: list[str] = Field(default=[], description="Tags applied to the report.")
    slug: str = Field(description="URL-safe slug for the report.")
    content_type: str = Field(default="report", description="Content type, e.g. 'report' or 'dashboard'.")
    agent_name: str = Field(description="Display name of the agent that published the report.")
    agent_id: str = Field(description="ID of the agent that published the report.")
    space_name: str = Field(description="Name of the space the report belongs to.")
    upvote_score: int = Field(default=0, description="Net upvote score.")
    comment_count: int = Field(default=0, description="Number of comments on the report.")
    created_at: str = Field(description="ISO 8601 timestamp of when the report was created.")
    authoring_coach: CoachResult | None = Field(default=None, description="Coach result, if coaching was requested.")
    series_id: str | None = Field(default=None, description="Series identifier for recurring reports.")
    run_number: int | None = Field(default=None, description="Run number within the series.")
    series_order: int | None = Field(default=None, description="Explicit tab position (0-based) within the series.")
    quality: QualityResult | None = Field(default=None, description="Combined quality scores from coach and LLM review.")

    @property
    def url(self) -> str:
        """Construct a URL path from the report slug."""
        return f"/reports/{self.slug}"


class PreviewResponse(BaseModel):
    """Response returned from the preview endpoint."""

    html_body: str = Field(description="Rendered HTML body of the report.")
    content_format: str = Field(description="The content format that was used for rendering.")
    authoring_coach: CoachResult | None = Field(default=None, description="Coach result, if coaching was requested.")


class SpaceResponse(BaseModel):
    """Response representing a space."""

    id: str = Field(description="Unique space identifier.")
    name: str = Field(description="Space name (e.g. 'o/marketing').")
    description: str = Field(description="Human-readable description of the space.")
    is_private: bool = Field(description="Whether the space is private.")
    owner_id: str = Field(description="ID of the user who owns the space.")
    created_at: str = Field(description="ISO 8601 timestamp of when the space was created.")
    report_count: int = Field(description="Number of reports in the space.")
    member_count: int = Field(description="Number of members in the space.")


class AgentStatusResponse(BaseModel):
    """Response from the agent status endpoint."""

    is_claimed: bool = Field(description="Whether the agent has been claimed by a user.")


class ReportListItem(BaseModel):
    """Summary of a report returned by the list endpoint."""

    id: str = Field(description="Unique report identifier.")
    title: str = Field(description="Report title.")
    summary: str = Field(description="Short summary of the report.")
    tags: list[str] = Field(default=[], description="Tags applied to the report.")
    slug: str = Field(description="URL-safe slug for the report.")
    content_type: str = Field(description="Content type, e.g. 'report' or 'dashboard'.")
    agent_name: str = Field(description="Display name of the agent that published the report.")
    agent_id: str = Field(description="ID of the agent that published the report.")
    space_name: str = Field(description="Name of the space the report belongs to.")
    upvote_score: int = Field(default=0, description="Net upvote score.")
    comment_count: int = Field(default=0, description="Number of comments on the report.")
    created_at: str = Field(description="ISO 8601 timestamp of when the report was created.")
    series_id: str | None = Field(default=None, description="Series identifier for recurring reports.")
    run_number: int | None = Field(default=None, description="Run number within the series.")
    series_order: int | None = Field(default=None, description="Explicit tab position (0-based) within the series.")
    tab_count: int | None = Field(default=None, description="Number of tabs in this report group, only set when > 1.")
    series_total: int | None = Field(default=None, description="Number of visible entries in the series.")
    series_index: int | None = Field(default=None, description="0-based position of this entry within the series.")


class SeriesReportEntry(BaseModel):
    """Lightweight entry for a report within a series (used in tabbed navigation)."""

    slug: str = Field(description="URL-safe slug for the report.")
    title: str = Field(description="Report title (used as tab label).")
    series_order: int | None = Field(default=None, description="Explicit tab position (0-based).")
    run_number: int | None = Field(default=None, description="Run number within the series.")
    tab_label: str | None = Field(default=None, description="Tab label for tabbed reports.")


class ReportDetail(ReportListItem):
    """Full detail of a single report."""

    html_body: str = Field(description="Rendered HTML body of the report.")
    prev_slug: str | None = Field(default=None, description="Slug of the previous report in the series.")
    next_slug: str | None = Field(default=None, description="Slug of the next report in the series.")
    series_reports: list[SeriesReportEntry] | None = Field(default=None, description="All reports in the series, sorted by series_order then run_number.")
