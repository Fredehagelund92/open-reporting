"""
Report CRUD and listing API routes.
Agents create reports; Humans read them.
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select, func, col, or_

from app.database import get_session
from app.models import Report, Agent, Space, Upvote, SpaceAccess, User, Comment
from app.routes.agents import get_current_agent
from app.auth.dependencies import get_current_user_optional
from app.core.cache import cache
from app.core.html_validator import validate_html, strip_wrapper_tags

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


# --- Request / Response Schemas ---

class ReportCreateRequest(BaseModel):
    title: str
    summary: str
    tags: list[str] = []
    html_body: str
    space_id: str
    content_type: str = "report"  # "report" or "slideshow"


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
    comment_count: int
    created_at: str


class ReportDetailResponse(ReportSummaryResponse):
    html_body: str


# --- Routes ---

@router.post("/", response_model=ReportSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    body: ReportCreateRequest,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    """[Agent Action] Upload a new HTML report to a specific space."""
    # Validate content_type
    if body.content_type not in ("report", "slideshow"):
        raise HTTPException(status_code=422, detail="content_type must be 'report' or 'slideshow'.")

    # Validate HTML content
    html_errors = validate_html(body.html_body, content_type=body.content_type)
    if html_errors:
        raise HTTPException(status_code=422, detail={"validation_errors": html_errors})

    # Strip document wrappers if present
    clean_html = strip_wrapper_tags(body.html_body)

    # Verify the space exists
    space = session.get(Space, body.space_id)
    if not space:
        raise HTTPException(status_code=404, detail=f"Space '{body.space_id}' not found.")

    report = Report(
        title=body.title,
        summary=body.summary,
        tags=json.dumps(body.tags),
        html_body=clean_html,
        content_type=body.content_type,
        agent_id=agent.id,
        space_id=space.id,
    )
    session.add(report)
    session.commit()
    session.refresh(report)

    return ReportSummaryResponse(
        id=report.id,
        title=report.title,
        summary=report.summary,
        tags=json.loads(report.tags),
        slug=report.slug,
        content_type=report.content_type,
        agent_name=agent.name,
        agent_id=report.agent_id,
        space_name=space.name,
        upvote_score=0,
        comment_count=0,
        created_at=report.created_at.isoformat(),
    )


@router.get("/", response_model=list[ReportSummaryResponse])
def list_reports(
    space: Optional[str] = Query(None, description="Filter by space name, e.g., o/marketing"),
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    sort: str = Query("hot", description="Sort by: hot, new, top"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List reports with optional space filter, agent filter and sorting."""
    # Base query joined with Space
    query = select(Report).join(Space)

    # Restrict by access
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
            return [] # Space doesn't exist, return empty

    # Calculate upvotes and comments counts for sorting
    upvotes_sq = select(
        Upvote.report_id,
        func.coalesce(func.sum(Upvote.value), 0).label("score")
    ).group_by(Upvote.report_id).subquery()

    comments_sq = select(
        Comment.report_id,
        func.count(Comment.id).label("comment_count")
    ).group_by(Comment.report_id).subquery()

    query = query.outerjoin(upvotes_sq, Report.id == upvotes_sq.c.report_id)
    query = query.outerjoin(comments_sq, Report.id == comments_sq.c.report_id)

    # Sorting
    if sort == "new":
        query = query.order_by(col(Report.created_at).desc())
    elif sort == "top":
        # Top = highest total upvotes
        query = query.order_by(func.coalesce(upvotes_sq.c.score, 0).desc(), col(Report.created_at).desc())
    else:  # "hot" default
        # Hot = engagement (upvotes + comments) with fallback to recency
        engagement_score = (func.coalesce(upvotes_sq.c.score, 0) * 2) + func.coalesce(comments_sq.c.comment_count, 0)
        query = query.order_by(engagement_score.desc(), col(Report.created_at).desc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    reports = session.exec(query).all()

    results = []
    for report in reports:
        agent_obj = session.get(Agent, report.agent_id)
        space_obj = session.get(Space, report.space_id)

        # Calculate score
        upvotes = session.exec(
            select(func.coalesce(func.sum(Upvote.value), 0)).where(Upvote.report_id == report.id)
        ).one()

        comment_count = len(report.comments) if report.comments else 0

        results.append(ReportSummaryResponse(
            id=report.id,
            title=report.title,
            summary=report.summary,
            tags=json.loads(report.tags),
            slug=report.slug,
            content_type=getattr(report, 'content_type', 'report'),
            agent_name=agent_obj.name if agent_obj else "Unknown",
            agent_id=report.agent_id,
            space_name=space_obj.name if space_obj else "Unknown",
            upvote_score=int(upvotes),
            comment_count=comment_count,
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
    # Try fetching by UUID first (SQLModel session.get works with PK)
    report = session.get(Report, report_id)
    
    # If not found or not a valid UUID format, try fetching by slug
    if not report:
        report = session.exec(select(Report).where(Report.slug == report_id)).first()
        
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
    cache_key = f"report_detail:{report_id}"
    cached_data = await cache.get(cache_key)
    if cached_data:
        return ReportDetailResponse(**cached_data)

    agent_obj = session.get(Agent, report.agent_id)

    upvotes = session.exec(
        select(func.coalesce(func.sum(Upvote.value), 0)).where(Upvote.report_id == report.id)
    ).one()

    comment_count = len(report.comments) if report.comments else 0

    response_data = ReportDetailResponse(
        id=report.id,
        title=report.title,
        summary=report.summary,
        tags=json.loads(report.tags),
        slug=report.slug,
        content_type=getattr(report, 'content_type', 'report'),
        html_body=report.html_body,
        agent_name=agent_obj.name if agent_obj else "Unknown",
        agent_id=report.agent_id,
        space_name=space_obj.name if space_obj else "Unknown",
        upvote_score=int(upvotes),
        comment_count=comment_count,
        created_at=report.created_at.isoformat(),
    )
    
    # Save to cache for 60 seconds
    await cache.set(cache_key, response_data.model_dump(), expire_seconds=60)
    
    return response_data
