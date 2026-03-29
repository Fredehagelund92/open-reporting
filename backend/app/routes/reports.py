"""
Report CRUD and listing API routes.
Agents create reports; Humans read them.
"""

import json as _json
import re
import uuid
from typing import Optional, Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Header,
    status,
    BackgroundTasks,
)
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import selectinload, aliased
from sqlmodel import Session, select, func, col, or_, and_

from app.database import get_session, db_url
from app.models import (
    Report,
    Agent,
    Space,
    Upvote,
    SpaceAccess,
    User,
    Comment,
    Tag,
    ReportTag,
    ChatConversation,
    ChatMessage,
    Reaction,
    Mention,
)
from app.routes.agents import get_current_agent
from app.auth.dependencies import get_current_user_optional, get_current_user
from app.core.cache import cache
from app.core.html_validator import (
    validate_html,
    strip_wrapper_tags,
    sanitize_forbidden_tags,
)
from app.core.authoring_coach import (
    evaluate_authoring_quality,
    get_authoring_coach_mode,
)
from app.core.llm_review import review_report, get_llm_review_mode
from app.core.chart_validation import extract_chart_blocks_from_markdown
from app.core.renderers import render_markdown_to_html, render_structured_to_html
from app.core.tags import (
    resolve_canonical_tags,
    attach_tags_to_report,
    recalculate_tag_usage_counts,
    normalize_tag_key,
)
from app.core.notifications import notify_subscribers

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


def generate_slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return f"{slug}-{uuid.uuid4().hex[:6]}"


def _report_tag_names(report: Report) -> list[str]:
    return [link.tag.canonical_name for link in report.report_tags if link.tag]


def _can_delete_report(
    *,
    current_user: Optional[User],
    agent_obj: Optional[Agent],
    space_obj: Optional[Space],
) -> bool:
    if not current_user:
        return False
    if current_user.role == "ADMIN":
        return True
    if agent_obj and agent_obj.owner_id == current_user.id:
        return True
    if space_obj and space_obj.owner_id == current_user.id:
        return True
    return False


def _get_report_by_id_or_slug(session: Session, report_id: str) -> Optional[Report]:
    report = session.get(Report, report_id)
    if report:
        return report
    return session.exec(select(Report).where(Report.slug == report_id)).first()


def _resolve_run_number(
    session: Session,
    series_id: Optional[str],
    agent_id: str,
    tab_label: Optional[str],
    series_order: Optional[int],
    explicit_run_number: Optional[int] = None,
) -> Optional[int]:
    """Compute run_number for a new report in a series."""
    if not series_id:
        return None
    if explicit_run_number is not None:
        return explicit_run_number
    if tab_label is not None and series_order is not None and series_order > 0:
        # Secondary tab: join the latest run
        latest = session.exec(
            select(func.max(Report.run_number)).where(
                Report.series_id == series_id,
                Report.agent_id == agent_id,
            )
        ).one()
        return latest if latest else 1
    else:
        # Primary tab (series_order=0) or standalone series entry: new run
        max_run = session.exec(
            select(func.max(Report.run_number)).where(
                Report.series_id == series_id,
                Report.agent_id == agent_id,
            )
        ).one()
        return (max_run or 0) + 1


# --- Request / Response Schemas ---


class ReportCreateRequest(BaseModel):
    title: str
    summary: str
    tags: list[str] = []
    html_body: Optional[str] = None
    markdown_body: Optional[str] = None
    structured_body: Optional[dict] = None
    content_format: str = "auto"  # "auto" | "html" | "markdown" | "json"
    theme: Optional[str] = None
    layout: Optional[str] = None  # "narrow" | "standard" | "wide" | "full"
    space_id: Optional[str] = None
    space_name: Optional[str] = None
    content_type: str = "report"  # "report" or "slideshow"
    meta: Optional[dict] = None
    series_id: Optional[str] = None
    series_order: Optional[int] = None
    tab_label: Optional[str] = None
    run_number: Optional[int] = None

    @field_validator("series_id")
    @classmethod
    def _validate_series_id(cls, v: Optional[str]) -> Optional[str]:
        if v and (not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", v) or len(v) > 100):
            raise ValueError("series_id must be a lowercase slug, max 100 chars")
        return v

    @field_validator("series_order")
    @classmethod
    def _validate_series_order(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("series_order must be >= 0")
        return v


class AuthoringCoachIssueResponse(BaseModel):
    rule_id: str
    severity: str
    message: str
    suggestion: str


class AuthoringCoachResponse(BaseModel):
    readiness_status: str
    overall_score: int
    mode: str
    issues: list[AuthoringCoachIssueResponse] = []
    suggested_edits: list[str] = []
    sanitization_applied: Optional[list[dict]] = None


class LlmReviewResponse(BaseModel):
    status: str  # "passed", "blocked", "skipped"
    average_score: float = 0.0
    scores: dict = {}
    issues: list[str] = []
    fix_instructions: list[str] = []


class QualityResponse(BaseModel):
    coach_score: int
    coach_status: str
    llm_review: Optional[LlmReviewResponse] = None


class SeriesReportEntry(BaseModel):
    slug: str
    title: str
    series_order: Optional[int] = None
    run_number: Optional[int] = None
    tab_label: Optional[str] = None


class ReportSummaryResponse(BaseModel):
    id: str
    title: str
    summary: str
    tags: list[str]
    slug: str
    content_type: str = "report"
    agent_name: str
    agent_id: str
    space_name: str
    upvote_score: int
    user_vote: int = 0
    comment_count: int
    can_delete: bool = False
    created_at: str
    authoring_coach: Optional[AuthoringCoachResponse] = None
    sanitization_applied: Optional[list[dict]] = None
    series_id: Optional[str] = None
    run_number: Optional[int] = None
    series_order: Optional[int] = None
    tab_count: Optional[int] = None
    series_total: Optional[int] = None
    series_index: Optional[int] = None
    quality: Optional[QualityResponse] = None


class ReportDetailResponse(ReportSummaryResponse):
    html_body: str
    chat_enabled: bool = False
    prev_slug: Optional[str] = None
    next_slug: Optional[str] = None
    series_reports: Optional[list[SeriesReportEntry]] = None


# --- Routes ---


def _resolve_body(
    body: ReportCreateRequest,
    brand_overrides: dict | None = None,
) -> tuple[str, str, Optional[str]]:
    """Resolve the submitted body to (rendered_html, content_format, source_body).

    Supports three input formats:
    - markdown_body → rendered to themed HTML
    - structured_body → rendered to themed HTML from JSON sections
    - html_body → passed through as-is (backward compatible)
    """
    fmt = body.content_format

    if fmt == "auto":
        if body.markdown_body:
            fmt = "markdown"
        elif body.structured_body:
            fmt = "json"
        elif body.html_body:
            fmt = "html"
        else:
            raise HTTPException(
                status_code=422,
                detail="Provide html_body, markdown_body, or structured_body.",
            )

    if fmt == "markdown":
        if not body.markdown_body:
            raise HTTPException(
                status_code=422,
                detail="markdown_body is required when content_format is 'markdown'.",
            )
        rendered = render_markdown_to_html(
            body.markdown_body,
            theme=body.theme,
            layout=body.layout,
            brand_overrides=brand_overrides,
        )
        return rendered, "markdown", body.markdown_body

    if fmt == "json":
        if not body.structured_body:
            raise HTTPException(
                status_code=422,
                detail="structured_body is required when content_format is 'json'.",
            )
        sections = body.structured_body.get("sections", [])
        if not sections:
            raise HTTPException(
                status_code=422,
                detail="structured_body must contain a 'sections' list.",
            )
        rendered = render_structured_to_html(
            sections,
            theme=body.theme,
            layout=body.layout,
            brand_overrides=brand_overrides,
            content_type=body.content_type,
        )
        return rendered, "json", _json.dumps(body.structured_body)

    if fmt == "html":
        if not body.html_body:
            raise HTTPException(
                status_code=422,
                detail="html_body is required when content_format is 'html'.",
            )
        return body.html_body, "html", None

    raise HTTPException(
        status_code=422,
        detail=f"Invalid content_format: '{fmt}'. Use 'auto', 'html', 'markdown', or 'json'.",
    )


def _run_authoring_coach(
    body: ReportCreateRequest,
    resolved_html: Optional[str] = None,
    resolved_format: str = "html",
) -> AuthoringCoachResponse:
    html_for_coach = resolved_html or body.html_body or ""

    chart_sections = None
    if resolved_format == "json" and body.structured_body:
        chart_sections = [
            s
            for s in body.structured_body.get("sections", [])
            if isinstance(s, dict) and s.get("type", "").endswith("-chart")
        ]
    elif resolved_format == "markdown" and body.markdown_body:
        chart_sections = extract_chart_blocks_from_markdown(body.markdown_body)

    coach_result = evaluate_authoring_quality(
        title=body.title,
        summary=body.summary,
        html_body=html_for_coach,
        content_type=body.content_type,
        tags=body.tags,
        content_format=resolved_format,
        chart_sections=chart_sections or None,
    )
    return AuthoringCoachResponse(
        readiness_status=coach_result.readiness_status,
        overall_score=coach_result.overall_score,
        mode=get_authoring_coach_mode(),
        issues=[
            AuthoringCoachIssueResponse(
                rule_id=issue.rule_id,
                severity=issue.severity,
                message=issue.message,
                suggestion=issue.suggestion,
            )
            for issue in coach_result.issues
        ],
        suggested_edits=coach_result.suggested_edits,
    )


def _require_user_or_agent(
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
    authorization: Optional[str] = Header(None),
    session: Session = Depends(get_session),
) -> None:
    # 1. Check if we have an active human session
    # (Note: get_current_user_optional already returns None if user is deactivated)
    if current_user:
        return

    # 2. Check if we have an active agent key
    if authorization and authorization.startswith("Bearer "):
        api_key = authorization.split("Bearer ", 1)[1].strip()
        if api_key:
            from app.routes.agents import _get_agent_by_key

            try:
                # This helper already checks agent.is_active and owner.is_active
                _get_agent_by_key(api_key, session)
                return
            except HTTPException:
                pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated or account is disabled.",
    )


@router.post("/coach/evaluate", response_model=AuthoringCoachResponse)
def evaluate_authoring_coach(
    body: ReportCreateRequest,
    _auth_ok: None = Depends(_require_user_or_agent),
):
    """Evaluate draft quality before publish for both user and agent workflows."""
    if body.content_type not in ("report", "slideshow"):
        raise HTTPException(
            status_code=422, detail="content_type must be 'report' or 'slideshow'."
        )

    rendered_html, content_format, _source = _resolve_body(body)

    clean_html, sanitization_warnings = sanitize_forbidden_tags(rendered_html)
    html_errors = validate_html(clean_html, content_type=body.content_type)
    if html_errors:
        return AuthoringCoachResponse(
            readiness_status="blocked",
            overall_score=0,
            mode=get_authoring_coach_mode(),
            issues=[
                AuthoringCoachIssueResponse(
                    rule_id="html_validation",
                    severity="error",
                    message=error,
                    suggestion="Fix this validation issue, then run coach evaluation again.",
                )
                for error in html_errors
            ],
            suggested_edits=["Resolve HTML validation errors before publishing."],
            sanitization_applied=sanitization_warnings or None,
        )

    coach_response = _run_authoring_coach(
        body, resolved_html=clean_html, resolved_format=content_format
    )
    coach_response.sanitization_applied = sanitization_warnings or None
    return coach_response


class PreviewResponse(BaseModel):
    html_body: str
    content_format: str
    authoring_coach: Optional[AuthoringCoachResponse] = None
    sanitization_applied: Optional[list[dict]] = None


@router.post("/preview", response_model=PreviewResponse)
def preview_report(
    body: ReportCreateRequest,
):
    """Preview rendered output without storing. Useful for iteration before publish."""
    if body.content_type not in ("report", "slideshow"):
        raise HTTPException(
            status_code=422, detail="content_type must be 'report' or 'slideshow'."
        )

    rendered_html, content_format, _source = _resolve_body(body)
    clean_html, sanitization_warnings = sanitize_forbidden_tags(rendered_html)

    html_errors = validate_html(clean_html, content_type=body.content_type)
    coach_response = None
    if not html_errors:
        coach_response = _run_authoring_coach(
            body, resolved_html=clean_html, resolved_format=content_format
        )
        coach_response.sanitization_applied = sanitization_warnings or None

    return PreviewResponse(
        html_body=strip_wrapper_tags(clean_html),
        content_format=content_format,
        authoring_coach=coach_response,
        sanitization_applied=sanitization_warnings or None,
    )


@router.post(
    "/", response_model=ReportSummaryResponse, status_code=status.HTTP_201_CREATED
)
def create_report(
    body: ReportCreateRequest,
    background_tasks: BackgroundTasks,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
    x_skill: Optional[str] = Header(None, alias="X-OpenReporting-Skill"),
):
    """[Agent Action] Upload a new HTML report to a specific space."""
    # Enforce agent claim status
    if not agent.is_claimed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent must be claimed by a user before posting reports.",
        )

    # Validate content_type
    if body.content_type not in ("report", "slideshow"):
        raise HTTPException(
            status_code=422, detail="content_type must be 'report' or 'slideshow'."
        )

    # Verify the space exists (either via ID or Name)
    space = None
    if body.space_id:
        space = session.get(Space, body.space_id)
    elif body.space_name:
        space = session.exec(select(Space).where(Space.name == body.space_name)).first()

    if not space:
        target = body.space_id or body.space_name or "unknown"
        raise HTTPException(status_code=422, detail=f"Space '{target}' not found.")

    # Apply space brand defaults when the request doesn't specify theme/layout
    if body.theme is None and space.default_theme:
        body.theme = space.default_theme
    if body.layout is None and space.default_layout:
        body.layout = space.default_layout

    # Build brand overrides from space branding
    brand_overrides = {}
    if space.brand_accent_color:
        brand_overrides["accent_color"] = space.brand_accent_color
    if space.brand_heading_color:
        brand_overrides["heading_color"] = space.brand_heading_color

    # Resolve body to HTML (handles markdown, json, or html passthrough)
    rendered_html, content_format, source_body = _resolve_body(
        body, brand_overrides=brand_overrides or None
    )

    # Sanitize forbidden tags, then validate
    clean_html, sanitization_warnings = sanitize_forbidden_tags(rendered_html)
    html_errors = validate_html(clean_html, content_type=body.content_type)
    if html_errors:
        raise HTTPException(status_code=422, detail={"validation_errors": html_errors})

    coach_feedback = _run_authoring_coach(
        body, resolved_html=clean_html, resolved_format=content_format
    )
    if (
        coach_feedback.mode == "enforce"
        and coach_feedback.readiness_status == "blocked"
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "coach_blocked": True,
                "authoring_coach": coach_feedback.model_dump(),
            },
        )

    # LLM review gate — runs only when coach passes
    llm_review_response: Optional[LlmReviewResponse] = None
    if coach_feedback.readiness_status != "blocked":
        coach_issue_msgs = [i.message for i in coach_feedback.issues]
        llm_result = review_report(
            html_body=clean_html,
            title=body.title,
            summary=body.summary,
            tags=body.tags,
            theme=body.theme or "default",
            content_type=body.content_type,
            coach_issues=coach_issue_msgs,
        )
        llm_review_response = LlmReviewResponse(
            status=llm_result.status,
            average_score=llm_result.average_score,
            scores={
                k: {"score": v.score, "issues": v.issues}
                for k, v in llm_result.scores.items()
            },
            issues=llm_result.issues,
            fix_instructions=llm_result.fix_instructions,
        )
        if get_llm_review_mode() == "enforce" and llm_result.status == "blocked":
            raise HTTPException(
                status_code=422,
                detail={
                    "llm_review_blocked": True,
                    "llm_review": llm_review_response.model_dump(),
                },
            )

    # Strip document wrappers if present
    clean_html = strip_wrapper_tags(clean_html)

    canonical_tags = resolve_canonical_tags(session, body.tags)

    # Consolidate metadata (internal field name 'meta' to avoid reserved keyword)
    report_metadata = body.meta or {}
    if x_skill:
        report_metadata["skill_attribution"] = x_skill

    run_number = _resolve_run_number(
        session,
        body.series_id,
        agent.id,
        body.tab_label,
        body.series_order,
        body.run_number,
    )

    report = Report(
        title=body.title,
        summary=body.summary,
        slug=generate_slug(body.title),
        html_body=clean_html,
        content_format=content_format,
        source_body=source_body,
        content_type=body.content_type,
        agent_id=agent.id,
        space_id=space.id,
        meta=report_metadata or None,
        series_id=body.series_id,
        run_number=run_number,
        series_order=body.series_order,
        tab_label=body.tab_label,
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    attach_tags_to_report(session, report, canonical_tags)
    recalculate_tag_usage_counts(session)
    session.commit()
    background_tasks.add_task(notify_subscribers, report.id)

    return ReportSummaryResponse(
        id=report.id,
        title=report.title,
        summary=report.summary,
        tags=[tag.canonical_name for tag in canonical_tags],
        slug=report.slug,
        content_type=report.content_type,
        agent_name=agent.name,
        agent_id=report.agent_id,
        space_name=space.name,
        upvote_score=0,
        user_vote=0,
        comment_count=0,
        created_at=report.created_at.isoformat(),
        authoring_coach=coach_feedback,
        sanitization_applied=sanitization_warnings or None,
        series_id=report.series_id,
        run_number=report.run_number,
        series_order=report.series_order,
        quality=QualityResponse(
            coach_score=coach_feedback.overall_score,
            coach_status=coach_feedback.readiness_status,
            llm_review=llm_review_response,
        ),
    )


class UserReportCreateRequest(BaseModel):
    title: str
    summary: str
    tags: list[str] = []
    html_body: Optional[str] = None
    markdown_body: Optional[str] = None
    structured_body: Optional[dict] = None
    content_format: str = "auto"
    theme: Optional[str] = None
    layout: Optional[str] = None
    space_name: str
    agent_id: str
    content_type: str = "report"
    meta: Optional[dict] = None
    series_id: Optional[str] = None
    series_order: Optional[int] = None
    tab_label: Optional[str] = None
    run_number: Optional[int] = None

    @field_validator("series_id")
    @classmethod
    def _validate_series_id(cls, v: Optional[str]) -> Optional[str]:
        if v and (not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", v) or len(v) > 100):
            raise ValueError("series_id must be a lowercase slug, max 100 chars")
        return v

    @field_validator("series_order")
    @classmethod
    def _validate_series_order(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("series_order must be >= 0")
        return v


@router.post(
    "/upload", response_model=ReportSummaryResponse, status_code=status.HTTP_201_CREATED
)
def upload_report_as_user(
    body: UserReportCreateRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """[User Action] Upload a report directly, published under one of the
    user's own agents.  The caller must supply ``agent_id``."""
    if body.content_type not in ("report", "slideshow"):
        raise HTTPException(
            status_code=422, detail="content_type must be 'report' or 'slideshow'."
        )

    agent = session.get(Agent, body.agent_id)
    if not agent:
        raise HTTPException(
            status_code=404, detail="Agent not found. Please create an agent first."
        )
    if agent.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this agent.")

    # Resolve space first for brand defaults
    space = session.exec(select(Space).where(Space.name == body.space_name)).first()
    if not space:
        raise HTTPException(
            status_code=422, detail=f"Space '{body.space_name}' not found."
        )

    # Apply space brand defaults
    theme = body.theme
    layout = body.layout
    if theme is None and space.default_theme:
        theme = space.default_theme
    if layout is None and space.default_layout:
        layout = space.default_layout

    brand_overrides = {}
    if space.brand_accent_color:
        brand_overrides["accent_color"] = space.brand_accent_color
    if space.brand_heading_color:
        brand_overrides["heading_color"] = space.brand_heading_color

    # Build a ReportCreateRequest for shared rendering/coach logic
    create_req = ReportCreateRequest(
        title=body.title,
        summary=body.summary,
        tags=body.tags,
        html_body=body.html_body,
        markdown_body=body.markdown_body,
        structured_body=body.structured_body,
        content_format=body.content_format,
        theme=theme,
        layout=layout,
        space_name=body.space_name,
        content_type=body.content_type,
    )

    rendered_html, content_format, source_body = _resolve_body(
        create_req, brand_overrides=brand_overrides or None
    )

    clean_html, sanitization_warnings = sanitize_forbidden_tags(rendered_html)
    html_errors = validate_html(clean_html, content_type=body.content_type)
    if html_errors:
        raise HTTPException(status_code=422, detail={"validation_errors": html_errors})

    coach_feedback = _run_authoring_coach(
        create_req, resolved_html=clean_html, resolved_format=content_format
    )
    if (
        coach_feedback.mode == "enforce"
        and coach_feedback.readiness_status == "blocked"
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "coach_blocked": True,
                "authoring_coach": coach_feedback.model_dump(),
            },
        )

    clean_html = strip_wrapper_tags(clean_html)

    canonical_tags = resolve_canonical_tags(session, body.tags)

    run_number = _resolve_run_number(
        session,
        body.series_id,
        agent.id,
        body.tab_label,
        body.series_order,
        body.run_number,
    )

    report = Report(
        title=body.title,
        summary=body.summary,
        slug=generate_slug(body.title),
        html_body=clean_html,
        content_format=content_format,
        source_body=source_body,
        content_type=body.content_type,
        agent_id=agent.id,
        space_id=space.id,
        series_id=body.series_id,
        run_number=run_number,
        series_order=body.series_order,
        tab_label=body.tab_label,
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    attach_tags_to_report(session, report, canonical_tags)
    recalculate_tag_usage_counts(session)
    session.commit()

    return ReportSummaryResponse(
        id=report.id,
        title=report.title,
        summary=report.summary,
        tags=[tag.canonical_name for tag in canonical_tags],
        slug=report.slug,
        content_type=report.content_type,
        agent_name=agent.name,
        agent_id=report.agent_id,
        space_name=space.name,
        upvote_score=0,
        user_vote=0,
        comment_count=0,
        created_at=report.created_at.isoformat(),
        authoring_coach=coach_feedback,
        sanitization_applied=sanitization_warnings or None,
        series_id=report.series_id,
        run_number=report.run_number,
        series_order=report.series_order,
    )


@router.get("/", response_model=list[ReportSummaryResponse])
async def list_reports(
    space: Optional[str] = Query(
        None, description="Filter by space name, e.g., o/marketing"
    ),
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    tag: Optional[str] = Query(None, description="Filter by canonical tag"),
    sort: str = Query("new", description="Sort by: trending, new, top"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List reports with optional space filter, agent filter and sorting."""

    # Check cache
    cache_viewer = current_user.id if current_user else "anon"
    cache_key = f"report_list:{sort}:{space}:{agent_id}:{agent_name}:{tag}:{page}:{page_size}:{cache_viewer}"
    cached_data = await cache.get(cache_key)
    if cached_data:
        return [ReportSummaryResponse(**item) for item in cached_data]

    # Pre-compute aggregation subqueries
    upvotes_sq = (
        select(Upvote.report_id, func.sum(Upvote.value).label("score"))
        .group_by(Upvote.report_id)
        .subquery()
    )

    comments_sq = (
        select(Comment.report_id, func.count(Comment.id).label("comment_count"))
        .group_by(Comment.report_id)
        .subquery()
    )

    ReportSibling = aliased(Report)
    tab_sq = (
        select(
            ReportSibling.series_id,  # type: ignore[attr-defined]
            ReportSibling.agent_id,  # type: ignore[attr-defined]
            func.coalesce(ReportSibling.run_number, -1).label("run_grp"),  # type: ignore[attr-defined]
            func.count(ReportSibling.id).label("tab_count"),  # type: ignore[attr-defined]
        )
        .where(
            ReportSibling.series_id.is_not(None),  # type: ignore[attr-defined]
            ReportSibling.tab_label.is_not(None),  # type: ignore[attr-defined]
        )
        .group_by(
            ReportSibling.series_id,  # type: ignore[attr-defined]
            ReportSibling.agent_id,  # type: ignore[attr-defined]
            func.coalesce(ReportSibling.run_number, -1),  # type: ignore[attr-defined]
        )
        .subquery()
    )

    # series_sq: count visible cards per series (for progress dots)
    VisibleSibling = aliased(Report)
    series_sq = (
        select(
            VisibleSibling.series_id,  # type: ignore[attr-defined]
            VisibleSibling.agent_id,  # type: ignore[attr-defined]
            func.count(VisibleSibling.id).label("series_total"),  # type: ignore[attr-defined]
        )
        .where(
            VisibleSibling.series_id.is_not(None),  # type: ignore[attr-defined]
            or_(
                VisibleSibling.tab_label.is_(None),  # type: ignore[attr-defined]
                VisibleSibling.series_order == 0,  # type: ignore[attr-defined]
                VisibleSibling.series_order.is_(None),  # type: ignore[attr-defined]
            ),
        )
        .group_by(
            VisibleSibling.series_id,  # type: ignore[attr-defined]
            VisibleSibling.agent_id,  # type: ignore[attr-defined]
        )
        .subquery()
    )

    # series_rank_sq: 0-based position of each visible card within its series
    RankedReport = aliased(Report)
    series_rank_sq = (
        select(
            RankedReport.id.label("ranked_id"),  # type: ignore[attr-defined]
            (
                func.row_number().over(
                    partition_by=[
                        RankedReport.series_id,  # type: ignore[attr-defined]
                        RankedReport.agent_id,  # type: ignore[attr-defined]
                    ],
                    order_by=[
                        func.coalesce(RankedReport.run_number, 0),  # type: ignore[attr-defined]
                        func.coalesce(RankedReport.series_order, 0),  # type: ignore[attr-defined]
                    ],
                )
                - 1
            ).label("series_index"),
        )
        .where(
            RankedReport.series_id.is_not(None),  # type: ignore[attr-defined]
            or_(
                RankedReport.tab_label.is_(None),  # type: ignore[attr-defined]
                RankedReport.series_order == 0,  # type: ignore[attr-defined]
                RankedReport.series_order.is_(None),  # type: ignore[attr-defined]
            ),
        )
        .subquery()
    )

    # Base query: join Agent and Space to avoid N+1 lookups
    query = (
        select(
            Report,
            Agent,
            Space,
            func.coalesce(upvotes_sq.c.score, 0).label("total_score"),
            func.coalesce(comments_sq.c.comment_count, 0).label("total_comments"),
            tab_sq.c.tab_count,
            series_sq.c.series_total,
            series_rank_sq.c.series_index,
        )
        .join(Agent, Report.agent_id == Agent.id)
        .join(Space, Report.space_id == Space.id)
        .outerjoin(upvotes_sq, Report.id == upvotes_sq.c.report_id)
        .outerjoin(comments_sq, Report.id == comments_sq.c.report_id)
        .outerjoin(
            tab_sq,
            and_(
                Report.series_id == tab_sq.c.series_id,
                Report.agent_id == tab_sq.c.agent_id,
                func.coalesce(Report.run_number, -1) == tab_sq.c.run_grp,
            ),
        )
        .outerjoin(
            series_sq,
            and_(
                Report.series_id == series_sq.c.series_id,
                Report.agent_id == series_sq.c.agent_id,
            ),
        )
        .outerjoin(series_rank_sq, Report.id == series_rank_sq.c.ranked_id)
        .options(selectinload(Report.report_tags).selectinload(ReportTag.tag))
    )

    # Access control
    if current_user and current_user.role == "ADMIN":
        pass  # Admin sees all
    elif current_user:
        access_sq = select(SpaceAccess.space_id).where(
            SpaceAccess.user_id == current_user.id
        )
        query = query.where(
            or_(
                Space.is_private.is_(False),
                Space.owner_id == current_user.id,
                col(Space.id).in_(access_sq),
            )
        )
    else:
        query = query.where(Space.is_private.is_(False))

    # Hide secondary tabs — only show standalone, primary tab, or non-tab reports
    query = query.where(
        or_(
            Report.tab_label.is_(None),       # standalone or time-series
            Report.series_order == 0,          # primary tab
            Report.series_order.is_(None),     # safety fallback
        )
    )

    # Filter by agent
    if agent_id:
        query = query.where(Report.agent_id == agent_id)
    elif agent_name:
        agent_obj = session.exec(select(Agent).where(Agent.name == agent_name)).first()
        if agent_obj:
            query = query.where(Report.agent_id == agent_obj.id)
        else:
            return []

    # Filter by space name
    if space:
        space_obj = session.exec(select(Space).where(Space.name == space)).first()
        if space_obj:
            query = query.where(Report.space_id == space_obj.id)
        else:
            return []  # Space doesn't exist, return empty

    # Filter by canonical tag
    if tag:
        normalized_tag = normalize_tag_key(tag)
        if not normalized_tag:
            return []
        tag_obj = session.exec(
            select(Tag).where(Tag.normalized_key == normalized_tag)
        ).first()
        if not tag_obj:
            return []
        query = query.join(ReportTag, Report.id == ReportTag.report_id).where(
            ReportTag.tag_id == tag_obj.id
        )

    # Sorting
    if sort == "new":
        query = query.order_by(col(Report.created_at).desc())
    elif sort == "top":
        query = query.order_by(
            func.coalesce(upvotes_sq.c.score, 0).desc(), col(Report.created_at).desc()
        )
    elif sort == "trending":
        # HN-style gravity: score / (age_hours + 2)^1.5
        # (age+2)^1.5 = (age+2) * sqrt(age+2) — avoids POW() for SQLite compat
        if db_url.startswith("postgresql"):
            age_hours = func.extract("epoch", func.now() - Report.created_at) / 3600.0
        else:
            age_hours = (
                func.julianday("now") - func.julianday(Report.created_at)
            ) * 24.0
        gravity = (age_hours + 2) * func.sqrt(age_hours + 2)
        trending_score = func.coalesce(upvotes_sq.c.score, 0) / gravity
        query = query.order_by(trending_score.desc(), col(Report.created_at).desc())
    else:
        query = query.order_by(col(Report.created_at).desc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Execute
    rows = session.exec(query).all()

    user_votes_by_report: dict[str, int] = {}
    if current_user and rows:
        report_ids = [report.id for report, _, _, _, _, _, _, _ in rows]
        user_vote_rows = session.exec(
            select(Upvote.report_id, Upvote.value).where(
                Upvote.user_id == current_user.id,
                col(Upvote.report_id).in_(report_ids),
            )
        ).all()
        user_votes_by_report = {
            report_id: int(value) for report_id, value in user_vote_rows
        }

    results = []
    for report, agent_obj, space_obj, score, comment_count, tab_count, series_total, series_index in rows:
        results.append(
            ReportSummaryResponse(
                id=report.id,
                title=report.title,
                summary=report.summary,
                tags=_report_tag_names(report),
                slug=report.slug,
                content_type=report.content_type,
                agent_name=agent_obj.name if agent_obj else "Unknown",
                agent_id=report.agent_id,
                space_name=space_obj.name if space_obj else "Unknown",
                upvote_score=int(score),
                user_vote=user_votes_by_report.get(report.id, 0),
                comment_count=int(comment_count),
                can_delete=_can_delete_report(
                    current_user=current_user,
                    agent_obj=agent_obj,
                    space_obj=space_obj,
                ),
                created_at=report.created_at.isoformat(),
                series_id=report.series_id,
                run_number=report.run_number,
                series_order=report.series_order,
                tab_count=int(tab_count) if tab_count else None,
                series_total=int(series_total) if series_total else None,
                series_index=int(series_index) if series_index is not None else None,
            )
        )

    # Cache for 30 seconds
    await cache.set(cache_key, [r.model_dump() for r in results], expire_seconds=30)

    return results


@router.get("/{report_id}", response_model=ReportDetailResponse)
async def get_report(
    report_id: str,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get a specific report including its full HTML body."""
    report = _get_report_by_id_or_slug(session, report_id)

    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    space_obj = session.get(Space, report.space_id)

    # Access check
    if space_obj.is_private:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        if current_user.role != "ADMIN" and space_obj.owner_id != current_user.id:
            acc = session.exec(
                select(SpaceAccess).where(
                    SpaceAccess.space_id == space_obj.id,
                    SpaceAccess.user_id == current_user.id,
                )
            ).first()
            if not acc:
                raise HTTPException(status_code=403, detail="Unrecognized report")

    # Check Cache
    cache_viewer = current_user.id if current_user else "anon"
    cache_key = f"report_detail:{report_id}:{cache_viewer}"
    cached_data = await cache.get(cache_key)
    if cached_data:
        return ReportDetailResponse(**cached_data)

    agent_obj = session.get(Agent, report.agent_id)

    upvotes = session.exec(
        select(func.coalesce(func.sum(Upvote.value), 0)).where(
            Upvote.report_id == report.id
        )
    ).one()
    user_vote = 0
    if current_user:
        existing_vote = session.exec(
            select(Upvote).where(
                Upvote.report_id == report.id, Upvote.user_id == current_user.id
            )
        ).first()
        if existing_vote:
            user_vote = existing_vote.value

    comment_count = session.exec(
        select(func.count(Comment.id)).where(Comment.report_id == report.id)
    ).one()

    series_total = prev_slug = next_slug = None
    series_reports = None
    if report.series_id:
        siblings = session.exec(
            select(Report).where(
                Report.series_id == report.series_id,
                Report.agent_id == report.agent_id,
            )
        ).all()
        siblings_sorted = sorted(siblings, key=lambda r: (
            r.series_order if r.series_order is not None else float('inf'),
            r.run_number if r.run_number is not None else float('inf'),
        ))
        series_reports = [
            SeriesReportEntry(
                slug=s.slug,
                title=s.title,
                series_order=s.series_order,
                run_number=s.run_number,
                tab_label=s.tab_label,
            )
            for s in siblings_sorted
        ]
        series_total = len(siblings_sorted)

        # Derive prev/next from sorted list for backward compat
        slugs = [s.slug for s in siblings_sorted]
        try:
            idx = slugs.index(report.slug)
            if idx > 0:
                prev_slug = slugs[idx - 1]
            if idx < len(slugs) - 1:
                next_slug = slugs[idx + 1]
        except ValueError:
            pass

    response_data = ReportDetailResponse(
        id=report.id,
        title=report.title,
        summary=report.summary,
        tags=_report_tag_names(report),
        slug=report.slug,
        content_type=report.content_type,
        html_body=report.html_body,
        agent_name=agent_obj.name if agent_obj else "Unknown",
        agent_id=report.agent_id,
        space_name=space_obj.name if space_obj else "Unknown",
        upvote_score=int(upvotes),
        user_vote=int(user_vote),
        comment_count=comment_count,
        can_delete=_can_delete_report(
            current_user=current_user,
            agent_obj=agent_obj,
            space_obj=space_obj,
        ),
        created_at=report.created_at.isoformat(),
        chat_enabled=agent_obj.chat_enabled if agent_obj else False,
        series_id=report.series_id,
        run_number=report.run_number,
        series_order=report.series_order,
        series_total=series_total,
        prev_slug=prev_slug,
        next_slug=next_slug,
        series_reports=series_reports,
    )

    # Save to cache for 60 seconds
    await cache.set(cache_key, response_data.model_dump(), expire_seconds=60)

    return response_data


class ReportUpdateRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    html_body: Optional[str] = None
    markdown_body: Optional[str] = None
    structured_body: Optional[dict] = None
    content_format: Optional[str] = None  # "html" | "markdown" | "json"
    theme: Optional[str] = None
    layout: Optional[str] = None
    tags: Optional[list[str]] = None
    content_type: Optional[str] = None


@router.patch("/{report_id}", response_model=ReportSummaryResponse)
def update_report(
    report_id: str,
    body: ReportUpdateRequest,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    """[Agent Action] Update an existing report in place.

    Only the agent that originally published the report may update it.
    Runs HTML validation and authoring coach on the new content.
    """
    report = _get_report_by_id_or_slug(session, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    if report.agent_id != agent.id:
        raise HTTPException(
            status_code=403, detail="Only the publishing agent may update this report."
        )

    if body.content_type is not None and body.content_type not in (
        "report",
        "slideshow",
    ):
        raise HTTPException(
            status_code=422, detail="content_type must be 'report' or 'slideshow'."
        )

    # Apply partial updates
    if body.title is not None:
        report.title = body.title
    if body.summary is not None:
        report.summary = body.summary
    if body.content_type is not None:
        report.content_type = body.content_type

    effective_content_type = report.content_type

    sanitization_warnings: list[dict[str, str]] = []
    update_format = report.content_format or "html"

    # Determine if a new body was submitted
    has_new_body = (
        body.html_body is not None
        or body.markdown_body is not None
        or body.structured_body is not None
    )

    if has_new_body:
        # Build a temporary create request to use _resolve_body
        temp_req = ReportCreateRequest(
            title=report.title,
            summary=report.summary,
            html_body=body.html_body,
            markdown_body=body.markdown_body,
            structured_body=body.structured_body,
            content_format=body.content_format or "auto",
            theme=body.theme,
            layout=body.layout,
            content_type=effective_content_type,
        )
        rendered_html, update_format, source_body = _resolve_body(temp_req)

        clean_html, sanitization_warnings = sanitize_forbidden_tags(rendered_html)
        html_errors = validate_html(clean_html, content_type=effective_content_type)
        if html_errors:
            raise HTTPException(
                status_code=422, detail={"validation_errors": html_errors}
            )
        report.html_body = strip_wrapper_tags(clean_html)
        report.content_format = update_format
        report.source_body = source_body

    # Re-run coach on the full (post-patch) state
    coach_feedback = _run_authoring_coach(
        ReportCreateRequest(
            title=report.title,
            summary=report.summary,
            html_body=report.html_body,
            content_type=effective_content_type,
            tags=body.tags or [],
        ),
        resolved_html=report.html_body,
        resolved_format=update_format,
    )
    if (
        coach_feedback.mode == "enforce"
        and coach_feedback.readiness_status == "blocked"
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "coach_blocked": True,
                "authoring_coach": coach_feedback.model_dump(),
            },
        )

    if body.tags is not None:
        canonical_tags = resolve_canonical_tags(session, body.tags)
        attach_tags_to_report(session, report, canonical_tags)

    session.add(report)
    session.commit()
    session.refresh(report)
    recalculate_tag_usage_counts(session)
    session.commit()

    space_obj = session.get(Space, report.space_id)
    upvotes = session.exec(
        select(func.coalesce(func.sum(Upvote.value), 0)).where(
            Upvote.report_id == report.id
        )
    ).one()
    comment_count = session.exec(
        select(func.count(Comment.id)).where(Comment.report_id == report.id)
    ).one()

    return ReportSummaryResponse(
        id=report.id,
        title=report.title,
        summary=report.summary,
        tags=_report_tag_names(report),
        slug=report.slug,
        content_type=report.content_type,
        agent_name=agent.name,
        agent_id=report.agent_id,
        space_name=space_obj.name if space_obj else "Unknown",
        upvote_score=int(upvotes),
        user_vote=0,
        comment_count=int(comment_count),
        created_at=report.created_at.isoformat(),
        authoring_coach=coach_feedback,
        sanitization_applied=sanitization_warnings or None,
        series_id=report.series_id,
        run_number=report.run_number,
        series_order=report.series_order,
    )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a report as platform admin, space owner, or agent owner."""
    report = _get_report_by_id_or_slug(session, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    agent_obj = session.get(Agent, report.agent_id)
    space_obj = session.get(Space, report.space_id)
    if not _can_delete_report(
        current_user=current_user, agent_obj=agent_obj, space_obj=space_obj
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this report"
        )

    # Cleanup all dependent rows before deleting the report.
    # Chat messages belong to conversations, so delete them first.
    conversations = session.exec(
        select(ChatConversation).where(ChatConversation.report_id == report.id)
    ).all()
    for convo in conversations:
        messages = session.exec(
            select(ChatMessage).where(ChatMessage.conversation_id == convo.id)
        ).all()
        for msg in messages:
            session.delete(msg)
        session.delete(convo)

    for model in (Comment, Upvote):
        rows = session.exec(select(model).where(model.report_id == report.id)).all()
        for row in rows:
            session.delete(row)

    for model in (Reaction, Mention):
        rows = session.exec(select(model).where(model.report_id == report.id)).all()
        for row in rows:
            session.delete(row)

    report_tag_links = session.exec(
        select(ReportTag).where(ReportTag.report_id == report.id)
    ).all()
    for link in report_tag_links:
        session.delete(link)

    session.delete(report)
    session.commit()
    recalculate_tag_usage_counts(session)
    session.commit()
    return None
