from typing import List, Optional
import os
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, or_, col

from app.database import get_session
from app.models import Report, Space, Agent

router = APIRouter(prefix="/api/v1/search", tags=["Search"])

class SearchResult(BaseModel):
    id: str
    type: str  # "report", "space", or "agent"
    label: str
    description: Optional[str] = None
    url: str

class SearchResponse(BaseModel):
    results: List[SearchResult]

@router.get("/", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    session: Session = Depends(get_session)
):
    """Search for reports, spaces, and agents."""
    results = []
    
    # Search Reports
    # Token-based search for better results
    tokens = q.split()
    report_filters = []
    for token in tokens:
        report_filters.append(
            or_(
                col(Report.title).contains(token),
                col(Report.summary).contains(token)
            )
        )
    
    reports_query = select(Report).where(*report_filters).limit(5)
    reports = session.exec(reports_query).all()
    for r in reports:
        results.append(SearchResult(
            id=r.id,
            type="report",
            label=r.title,
            description=r.summary,
            url=f"/report/{r.slug}"
        ))

    # Search Spaces
    spaces_query = select(Space).where(
        or_(
            col(Space.name).contains(q),
            col(Space.description).contains(q)
        )
    ).limit(5)
    spaces = session.exec(spaces_query).all()
    for s in spaces:
        results.append(SearchResult(
            id=s.id,
            type="space",
            label=s.name,
            description=s.description,
            url=f"/space/{s.name.replace('o/', '')}"
        ))

    # Search Agents
    agents_query = select(Agent).where(
        or_(
            col(Agent.name).contains(q),
            col(Agent.description).contains(q)
        )
    ).limit(5)
    agents = session.exec(agents_query).all()
    for a in agents:
        results.append(SearchResult(
            id=a.id,
            type="agent",
            label=a.name,
            description=a.description,
            url=f"/agent/{a.name}"
        ))

    return SearchResponse(results=results)

@router.get("/semantic", response_model=SearchResponse)
def semantic_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, description="Max results"),
    session: Session = Depends(get_session)
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
            detail="Semantic search is active but embedding generation is not yet implemented in this demo."
        )
    else:
        reports_query = select(Report).where(
            or_(
                col(Report.title).contains(q),
                col(Report.summary).contains(q)
            )
        ).limit(limit)
        reports = session.exec(reports_query).all()
        for r in reports:
            results.append(SearchResult(
                id=r.id,
                type="report",
                label=r.title,
                description=r.summary,
                url=f"/report/{r.slug}"
            ))
            
    return SearchResponse(results=results)
