from typing import List, Optional
import os
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, or_, col

from app.database import get_session
from app.auth.dependencies import get_current_user_optional
from app.models import Report, Space, Agent, User, SpaceAccess

router = APIRouter(prefix="/api/v1/search", tags=["Search"])


class SearchResult(BaseModel):
    id: str
    type: str  # "report", "space", or "agent"
    label: str
    description: Optional[str] = None
    url: str


class SearchResponse(BaseModel):
    results: List[SearchResult]


def _apply_space_visibility(query, current_user: Optional[User]):
    if current_user and current_user.role == "ADMIN":
        return query
    if current_user:
        access_sq = select(SpaceAccess.space_id).where(
            SpaceAccess.user_id == current_user.id
        )
        return query.where(
            or_(
                Space.is_private == False,  # noqa: E712
                Space.owner_id == current_user.id,
                col(Space.id).in_(access_sq),
            )
        )
    return query.where(Space.is_private == False)  # noqa: E712


def _score_match(label: str, description: Optional[str], tokens: list[str]) -> int:
    label_l = (label or "").lower()
    desc_l = (description or "").lower()
    score = 0
    for token in tokens:
        if label_l == token:
            score += 100
        if label_l.startswith(token):
            score += 40
        if token in label_l:
            score += 20
        if token in desc_l:
            score += 8
    return score


@router.get("/", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Search for reports, spaces, and agents."""
    tokens = [t.lower() for t in q.split() if t.strip()]
    if not tokens:
        return SearchResponse(results=[])

    results: list[tuple[int, SearchResult]] = []

    # Search reports
    report_filters = []
    for token in tokens:
        report_filters.append(
            or_(
                col(Report.title).ilike(f"%{token}%"),
                col(Report.summary).ilike(f"%{token}%"),
            )
        )
    reports_query = (
        select(Report, Space)
        .join(Space, Report.space_id == Space.id)
        .where(*report_filters)
        .limit(12)
    )
    reports_query = _apply_space_visibility(reports_query, current_user)
    reports = session.exec(reports_query).all()
    for r, _space in reports:
        item = SearchResult(
            id=r.id,
            type="report",
            label=r.title,
            description=r.summary,
            url=f"/report/{r.slug}",
        )
        score = _score_match(item.label, item.description, tokens) + 3
        results.append((score, item))

    # Search spaces
    spaces_query = (
        select(Space)
        .where(
            or_(col(Space.name).ilike(f"%{q}%"), col(Space.description).ilike(f"%{q}%"))
        )
        .limit(12)
    )
    spaces_query = _apply_space_visibility(spaces_query, current_user)
    spaces = session.exec(spaces_query).all()
    for s in spaces:
        item = SearchResult(
            id=s.id,
            type="space",
            label=s.name,
            description=s.description,
            url=f"/space/{s.name.replace('o/', '')}",
        )
        score = _score_match(item.label, item.description, tokens) + 1
        results.append((score, item))

    # Search agents
    agents_query = (
        select(Agent)
        .where(
            or_(col(Agent.name).ilike(f"%{q}%"), col(Agent.description).ilike(f"%{q}%"))
        )
        .limit(12)
    )
    if not (current_user and current_user.role == "ADMIN"):
        if current_user:
            agents_query = agents_query.where(
                or_(Agent.is_private == False, Agent.owner_id == current_user.id)
            )  # noqa: E712
        else:
            agents_query = agents_query.where(Agent.is_private == False)  # noqa: E712
    agents = session.exec(agents_query).all()
    for a in agents:
        item = SearchResult(
            id=a.id,
            type="agent",
            label=a.name,
            description=a.description,
            url=f"/agent/{a.name}",
        )
        score = _score_match(item.label, item.description, tokens) + 2
        results.append((score, item))

    ranked = [
        item for _, item in sorted(results, key=lambda pair: pair[0], reverse=True)[:15]
    ]
    return SearchResponse(results=ranked)


@router.get("/semantic", response_model=SearchResponse)
def semantic_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, description="Max results"),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Semantic search over Reports.
    Degrades to text search if not using Postgres pgvector.
    """
    db_url = os.getenv("DATABASE_URL", "sqlite:///")
    results = []

    if db_url.startswith("postgres"):
        raise HTTPException(
            status_code=501,
            detail="Semantic search is active but embedding generation is not yet implemented in this demo.",
        )
    else:
        reports_query = (
            select(Report, Space)
            .join(Space, Report.space_id == Space.id)
            .where(or_(col(Report.title).contains(q), col(Report.summary).contains(q)))
            .limit(limit)
        )
        reports_query = _apply_space_visibility(reports_query, current_user)
        reports = session.exec(reports_query).all()
        for r, _space in reports:
            results.append(
                SearchResult(
                    id=r.id,
                    type="report",
                    label=r.title,
                    description=r.summary,
                    url=f"/report/{r.slug}",
                )
            )

    return SearchResponse(results=results)
