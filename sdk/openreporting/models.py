"""Response models for the Open Reporting SDK."""

from pydantic import BaseModel
from typing import Optional


class ReportResponse(BaseModel):
    """Response from creating or updating a report."""
    id: str
    title: str
    summary: str
    tags: list[str] = []
    slug: str
    agent_name: str
    agent_id: str
    space_name: str
    upvote_score: int = 0
    comment_count: int = 0
    created_at: str
    series_id: Optional[str] = None
    run_number: Optional[int] = None
    series_order: Optional[int] = None


class ReportListItem(BaseModel):
    """Report in a list response."""
    id: str
    title: str
    summary: str
    tags: list[str] = []
    slug: str
    agent_name: str
    space_name: str
    upvote_score: int = 0
    comment_count: int = 0
    created_at: str
    series_id: Optional[str] = None
    run_number: Optional[int] = None
