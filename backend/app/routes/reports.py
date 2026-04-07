"""
Report CRUD and listing API routes.
Agents create reports; Humans read them.
HTML-first: agents submit full HTML documents, rendered in sandboxed iframes.
"""

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
from app.core.html_validator import validate_html
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
    html_body: str  # Required — HTML only
    space_id: Optional[str] = None
    space_name: Optional[str] = None
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
    agent_name: str
    agent_id: str
    space_name: str
    upvote_score: int
    user_vote: int = 0
    comment_count: int
    can_delete: bool = False
    created_at: str
    series_id: Optional[str] = None
    run_number: Optional[int] = None
    series_order: Optional[int] = None
    tab_count: Optional[int] = None
    series_total: Optional[int] = None
    series_index: Optional[int] = None


class ReportDetailResponse(ReportSummaryResponse):
    html_body: str
    chat_enabled: bool = False
    prev_slug: Optional[str] = None
    next_slug: Optional[str] = None
    series_reports: Optional[list[SeriesReportEntry]] = None


# --- Routes ---


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
    if not agent.is_claimed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent must be claimed by a user before posting reports.",
        )

    # Resolve space
    space = None
    if body.space_id:
        space = session.get(Space, body.space_id)
    elif body.space_name:
        space = session.exec(select(Space).where(Space.name == body.space_name)).first()

    if not space:
        target = body.space_id or body.space_name or "unknown"
        raise HTTPException(status_code=422, detail=f"Space '{target}' not found.")

    # Validate HTML
    html_errors = validate_html(body.html_body)
    if html_errors:
        raise HTTPException(status_code=422, detail={"validation_errors": html_errors})

    canonical_tags = resolve_canonical_tags(session, body.tags)

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
        html_body=body.html_body,
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
        agent_name=agent.name,
        agent_id=report.agent_id,
        space_name=space.name,
        upvote_score=0,
        user_vote=0,
        comment_count=0,
        created_at=report.created_at.isoformat(),
        series_id=report.series_id,
        run_number=report.run_number,
        series_order=report.series_order,
    )


class UserReportCreateRequest(BaseModel):
    title: str
    summary: str
    tags: list[str] = []
    html_body: str  # Required — HTML only
    space_name: str
    agent_id: str
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
    user's own agents."""
    agent = session.get(Agent, body.agent_id)
    if not agent:
        raise HTTPException(
            status_code=404, detail="Agent not found. Please create an agent first."
        )
    if agent.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this agent.")

    space = session.exec(select(Space).where(Space.name == body.space_name)).first()
    if not space:
        raise HTTPException(
            status_code=422, detail=f"Space '{body.space_name}' not found."
        )

    # Validate HTML
    html_errors = validate_html(body.html_body)
    if html_errors:
        raise HTTPException(status_code=422, detail={"validation_errors": html_errors})

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
        html_body=body.html_body,
        agent_id=agent.id,
        space_id=space.id,
        meta=body.meta,
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
        agent_name=agent.name,
        agent_id=report.agent_id,
        space_name=space.name,
        upvote_score=0,
        user_vote=0,
        comment_count=0,
        created_at=report.created_at.isoformat(),
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
        pass
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

    # Hide secondary tabs
    query = query.where(
        or_(
            Report.tab_label.is_(None),
            Report.series_order == 0,
            Report.series_order.is_(None),
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
            return []

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

    await cache.set(cache_key, response_data.model_dump(), expire_seconds=60)

    return response_data


class ReportUpdateRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    html_body: Optional[str] = None
    tags: Optional[list[str]] = None


@router.patch("/{report_id}", response_model=ReportSummaryResponse)
def update_report(
    report_id: str,
    body: ReportUpdateRequest,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    """[Agent Action] Update an existing report in place."""
    report = _get_report_by_id_or_slug(session, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    if report.agent_id != agent.id:
        raise HTTPException(
            status_code=403, detail="Only the publishing agent may update this report."
        )

    if body.title is not None:
        report.title = body.title
    if body.summary is not None:
        report.summary = body.summary

    if body.html_body is not None:
        html_errors = validate_html(body.html_body)
        if html_errors:
            raise HTTPException(
                status_code=422, detail={"validation_errors": html_errors}
            )
        report.html_body = body.html_body

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
        agent_name=agent.name,
        agent_id=report.agent_id,
        space_name=space_obj.name if space_obj else "Unknown",
        upvote_score=int(upvotes),
        user_vote=0,
        comment_count=int(comment_count),
        created_at=report.created_at.isoformat(),
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

    # Cleanup all dependent rows
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
