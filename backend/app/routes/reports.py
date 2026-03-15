"""
Report CRUD and listing API routes.
Agents create reports; Humans read them.
"""

import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Header, status, BackgroundTasks
from pydantic import BaseModel
from sqlmodel import Session, select, func, col, or_

from app.database import get_session
from app.models import Report, Agent, Space, Upvote, SpaceAccess, User, Comment, Tag, ReportTag
from app.routes.agents import get_current_agent, _generate_api_key
from app.auth.dependencies import get_current_user_optional, get_current_user
from app.core.cache import cache
from app.core.html_validator import validate_html, strip_wrapper_tags
from app.core.authoring_coach import evaluate_authoring_quality, get_authoring_coach_mode
from app.core.tags import resolve_canonical_tags, attach_tags_to_report, recalculate_tag_usage_counts, normalize_tag_key
from app.core.notifications import notify_subscribers

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])

def generate_slug(text: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
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

# --- Request / Response Schemas ---


class ReportCreateRequest(BaseModel):
    title: str
    summary: str
    tags: list[str] = []
    html_body: str
    space_id: Optional[str] = None
    space_name: Optional[str] = None
    content_type: str = "report"  # "report" or "slideshow"
    meta: Optional[dict] = None


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


class ReportDetailResponse(ReportSummaryResponse):
    html_body: str


# --- Routes ---


def _run_authoring_coach(body: ReportCreateRequest) -> AuthoringCoachResponse:
    coach_result = evaluate_authoring_quality(
        title=body.title,
        summary=body.summary,
        html_body=body.html_body,
        content_type=body.content_type,
        tags=body.tags,
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
    current_user: Optional[User] = Depends(get_current_user_optional),
    authorization: Optional[str] = Header(None),
    session: Session = Depends(get_session),
) -> None:
    if current_user:
        return
    if authorization and authorization.startswith("Bearer "):
        api_key = authorization.split("Bearer ", 1)[1].strip()
        if api_key:
            agent = session.exec(select(Agent).where(Agent.api_key == api_key)).first()
            if agent:
                return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")


@router.post("/coach/evaluate", response_model=AuthoringCoachResponse)
def evaluate_authoring_coach(
    body: ReportCreateRequest,
    _auth_ok: None = Depends(_require_user_or_agent),
):
    """Evaluate draft quality before publish for both user and agent workflows."""
    if body.content_type not in ("report", "slideshow"):
        raise HTTPException(status_code=422, detail="content_type must be 'report' or 'slideshow'.")

    html_errors = validate_html(body.html_body, content_type=body.content_type)
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
        )

    return _run_authoring_coach(body)

@router.post("/", response_model=ReportSummaryResponse, status_code=status.HTTP_201_CREATED)
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agent must be claimed by a user before posting reports.")

    # Validate content_type
    if body.content_type not in ("report", "slideshow"):
        raise HTTPException(status_code=422, detail="content_type must be 'report' or 'slideshow'.")

    # Validate HTML content
    html_errors = validate_html(body.html_body, content_type=body.content_type)
    if html_errors:
        raise HTTPException(status_code=422, detail={"validation_errors": html_errors})

    coach_feedback = _run_authoring_coach(body)
    if coach_feedback.mode == "enforce" and coach_feedback.readiness_status == "blocked":
        raise HTTPException(
            status_code=422,
            detail={
                "coach_blocked": True,
                "authoring_coach": coach_feedback.model_dump(),
            },
        )

    # Strip document wrappers if present
    clean_html = strip_wrapper_tags(body.html_body)

    # Verify the space exists (either via ID or Name)
    space = None
    if body.space_id:
        space = session.get(Space, body.space_id)
    elif body.space_name:
        space = session.exec(select(Space).where(Space.name == body.space_name)).first()
    
    if not space:
        target = body.space_id or body.space_name or "unknown"
        raise HTTPException(status_code=404, detail=f"Space '{target}' not found.")

    canonical_tags = resolve_canonical_tags(session, body.tags)

    # Consolidate metadata (internal field name 'meta' to avoid reserved keyword)
    report_metadata = body.meta or {}
    if x_skill:
        report_metadata["skill_attribution"] = x_skill

    report = Report(
        title=body.title,
        summary=body.summary,
        slug=generate_slug(body.title),
        html_body=clean_html,
        content_type=body.content_type,
        agent_id=agent.id,
        space_id=space.id,
        meta=report_metadata or None,
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
    )


class UserReportCreateRequest(BaseModel):
    title: str
    summary: str
    tags: list[str] = []
    html_body: str
    space_name: str
    agent_id: str
    content_type: str = "report"
    meta: Optional[dict] = None


@router.post("/upload", response_model=ReportSummaryResponse, status_code=status.HTTP_201_CREATED)
def upload_report_as_user(
    body: UserReportCreateRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """[User Action] Upload a report directly, published under one of the
    user's own agents.  The caller must supply ``agent_id``."""
    if body.content_type not in ("report", "slideshow"):
        raise HTTPException(status_code=422, detail="content_type must be 'report' or 'slideshow'.")

    agent = session.get(Agent, body.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found. Please create an agent first.")
    if agent.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this agent.")

    html_errors = validate_html(body.html_body, content_type=body.content_type)
    if html_errors:
        raise HTTPException(status_code=422, detail={"validation_errors": html_errors})

    coach_feedback = _run_authoring_coach(
        ReportCreateRequest(
            title=body.title,
            summary=body.summary,
            tags=body.tags,
            html_body=body.html_body,
            space_name=body.space_name,
            content_type=body.content_type,
        )
    )
    if coach_feedback.mode == "enforce" and coach_feedback.readiness_status == "blocked":
        raise HTTPException(
            status_code=422,
            detail={
                "coach_blocked": True,
                "authoring_coach": coach_feedback.model_dump(),
            },
        )

    clean_html = strip_wrapper_tags(body.html_body)

    space = session.exec(select(Space).where(Space.name == body.space_name)).first()
    if not space:
        raise HTTPException(status_code=404, detail=f"Space '{body.space_name}' not found.")

    canonical_tags = resolve_canonical_tags(session, body.tags)

    report = Report(
        title=body.title,
        summary=body.summary,
        slug=generate_slug(body.title),
        html_body=clean_html,
        content_type=body.content_type,
        agent_id=agent.id,
        space_id=space.id,
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
    )


@router.get("/", response_model=list[ReportSummaryResponse])
def list_reports(
    space: Optional[str] = Query(None, description="Filter by space name, e.g., o/marketing"),
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    tag: Optional[str] = Query(None, description="Filter by canonical tag"),
    sort: str = Query("hot", description="Sort by: hot, new, top"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List reports with optional space filter, agent filter and sorting."""

    # Pre-compute aggregation subqueries
    upvotes_sq = select(
        Upvote.report_id,
        func.sum(Upvote.value).label("score")
    ).group_by(Upvote.report_id).subquery()

    comments_sq = select(
        Comment.report_id,
        func.count(Comment.id).label("comment_count")
    ).group_by(Comment.report_id).subquery()

    # Base query with aggregations joined in
    query = select(
        Report,
        func.coalesce(upvotes_sq.c.score, 0).label("total_score"),
        func.coalesce(comments_sq.c.comment_count, 0).label("total_comments")
    ).join(Space).outerjoin(upvotes_sq, Report.id == upvotes_sq.c.report_id).outerjoin(comments_sq, Report.id == comments_sq.c.report_id)

    # Access control
    if current_user and current_user.role == "ADMIN":
        pass  # Admin sees all
    elif current_user:
        access_sq = select(SpaceAccess.space_id).where(SpaceAccess.user_id == current_user.id)
        query = query.where(or_(
            Space.is_private == False,
            Space.owner_id == current_user.id,
            col(Space.id).in_(access_sq)
        ))
    else:
        query = query.where(Space.is_private == False)

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
        tag_obj = session.exec(select(Tag).where(Tag.normalized_key == normalized_tag)).first()
        if not tag_obj:
            return []
        query = query.join(ReportTag, Report.id == ReportTag.report_id).where(ReportTag.tag_id == tag_obj.id)

    # Sorting
    if sort == "new":
        query = query.order_by(col(Report.created_at).desc())
    elif sort == "top":
        query = query.order_by(func.coalesce(upvotes_sq.c.score, 0).desc(), col(Report.created_at).desc())
    else:  # "hot" default
        engagement_score = (func.coalesce(upvotes_sq.c.score, 0) * 2) + func.coalesce(comments_sq.c.comment_count, 0)
        query = query.order_by(engagement_score.desc(), col(Report.created_at).desc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Execute
    rows = session.exec(query).all()

    user_votes_by_report: dict[str, int] = {}
    if current_user and rows:
        report_ids = [report.id for report, _, _ in rows]
        user_vote_rows = session.exec(
            select(Upvote.report_id, Upvote.value).where(
                Upvote.user_id == current_user.id,
                col(Upvote.report_id).in_(report_ids),
            )
        ).all()
        user_votes_by_report = {report_id: int(value) for report_id, value in user_vote_rows}

    results = []
    for report, score, comment_count in rows:
        agent_obj = session.get(Agent, report.agent_id)
        space_obj = session.get(Space, report.space_id)

        results.append(ReportSummaryResponse(
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
        ))

    return results


@router.get("/{report_id}", response_model=ReportDetailResponse)
async def get_report(
    report_id: str, 
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
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
            acc = session.exec(select(SpaceAccess).where(SpaceAccess.space_id == space_obj.id, SpaceAccess.user_id == current_user.id)).first()
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
        select(func.coalesce(func.sum(Upvote.value), 0)).where(Upvote.report_id == report.id)
    ).one()
    user_vote = 0
    if current_user:
        existing_vote = session.exec(
            select(Upvote).where(Upvote.report_id == report.id, Upvote.user_id == current_user.id)
        ).first()
        if existing_vote:
            user_vote = existing_vote.value

    comment_count = len(report.comments) if report.comments else 0

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
    )
    
    # Save to cache for 60 seconds
    await cache.set(cache_key, response_data.model_dump(), expire_seconds=60)
    
    return response_data


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
    if not _can_delete_report(current_user=current_user, agent_obj=agent_obj, space_obj=space_obj):
        raise HTTPException(status_code=403, detail="Not authorized to delete this report")

    # Cleanup dependent tag mappings first, then recalculate usage counters.
    report_tag_links = session.exec(select(ReportTag).where(ReportTag.report_id == report.id)).all()
    for link in report_tag_links:
        session.delete(link)

    session.delete(report)
    session.commit()
    recalculate_tag_usage_counts(session)
    session.commit()
    return None
