"""
Authoring coach: deterministic pre-publish quality evaluation.

This module is intentionally rule-based (no model calls) so clients can rely on
stable, machine-readable feedback in retry loops.
"""

import os
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Literal


CoachSeverity = Literal["error", "warning", "info"]
CoachStatus = Literal["blocked", "needs_work", "ready"]
CoachMode = Literal["shadow", "enforce"]


@dataclass
class CoachIssue:
    rule_id: str
    severity: CoachSeverity
    message: str
    suggestion: str


@dataclass
class CoachResult:
    readiness_status: CoachStatus
    overall_score: int
    issues: list[CoachIssue]
    suggested_edits: list[str]


class _StructureInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.headings = 0
        self.sections = 0
        self.links = 0
        self.paragraph_lengths: list[int] = []
        self._paragraph_buffer: list[str] = []
        self._in_paragraph = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_lower = tag.lower()
        if tag_lower in {"h1", "h2", "h3"}:
            self.headings += 1
        if tag_lower == "section":
            self.sections += 1
        if tag_lower == "a":
            attr_map = {k.lower(): (v or "") for k, v in attrs}
            if attr_map.get("href", "").strip():
                self.links += 1
        if tag_lower == "p":
            self._in_paragraph = True
            self._paragraph_buffer = []

    def handle_data(self, data: str) -> None:
        if self._in_paragraph:
            self._paragraph_buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "p" and self._in_paragraph:
            text = "".join(self._paragraph_buffer).strip()
            self.paragraph_lengths.append(len(text))
            self._paragraph_buffer = []
            self._in_paragraph = False


def get_authoring_coach_mode() -> CoachMode:
    """
    Rollout toggle:
    - shadow: never block publish based on coach-only rules.
    - enforce: block publish when readiness_status == blocked.
    """
    raw = (os.getenv("AUTHORING_COACH_MODE") or "shadow").strip().lower()
    if raw in {"enforce", "strict", "blocking"}:
        return "enforce"
    return "shadow"


def evaluate_authoring_quality(
    *,
    title: str,
    summary: str,
    html_body: str,
    content_type: str,
    tags: list[str] | None = None,
) -> CoachResult:
    issues: list[CoachIssue] = []
    tags = tags or []

    plain_text = re.sub(r"<[^>]+>", " ", html_body)
    plain_text = re.sub(r"\s+", " ", plain_text).strip()

    inspector = _StructureInspector()
    try:
        inspector.feed(html_body)
    except Exception:
        # HTML parse issues are already handled by the main validator.
        pass

    title_trimmed = title.strip()
    summary_trimmed = summary.strip()

    if len(title_trimmed) < 6:
        issues.append(
            CoachIssue(
                rule_id="title_min_length",
                severity="error",
                message="Title is too short to communicate intent clearly.",
                suggestion="Use a descriptive title with at least 6 characters.",
            )
        )

    if len(plain_text) < 120:
        issues.append(
            CoachIssue(
                rule_id="content_substance",
                severity="error",
                message="Draft content is too short to be a meaningful report.",
                suggestion="Add more substantive body content before publishing.",
            )
        )

    if len(summary_trimmed) < 24:
        issues.append(
            CoachIssue(
                rule_id="summary_quality",
                severity="warning",
                message="Summary is brief and may be unclear in feed previews.",
                suggestion="Write a one-line summary with concrete context and takeaway.",
            )
        )

    if not tags:
        issues.append(
            CoachIssue(
                rule_id="tag_coverage",
                severity="warning",
                message="No tags provided; discoverability will be lower.",
                suggestion="Add 2-5 relevant tags so others can find this report.",
            )
        )

    if inspector.links == 0:
        issues.append(
            CoachIssue(
                rule_id="evidence_links",
                severity="warning",
                message="No links or citations detected.",
                suggestion="Add source links where claims rely on external facts.",
            )
        )

    if inspector.paragraph_lengths and max(inspector.paragraph_lengths) > 1200:
        issues.append(
            CoachIssue(
                rule_id="paragraph_density",
                severity="warning",
                message="Very long paragraph detected; readability may suffer.",
                suggestion="Break long paragraphs into smaller sections or bullet points.",
            )
        )

    score = 100
    for issue in issues:
        if issue.severity == "error":
            score -= 25
        elif issue.severity == "warning":
            score -= 10
        else:
            score -= 4
    score = max(0, min(100, score))

    has_error = any(issue.severity == "error" for issue in issues)
    has_warning = any(issue.severity == "warning" for issue in issues)

    if has_error:
        status: CoachStatus = "blocked"
    elif has_warning:
        status = "needs_work"
    else:
        status = "ready"

    suggested_edits = [issue.suggestion for issue in issues[:5]]

    return CoachResult(
        readiness_status=status,
        overall_score=score,
        issues=issues,
        suggested_edits=suggested_edits,
    )
