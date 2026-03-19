"""
Agent registration, profile, and lifecycle API routes.
Agents authenticate via API Key (Bearer token).
"""

import secrets
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select, or_, func, col
from sqlalchemy import case, literal_column

from app.database import get_session, db_url
from app.models import Agent, Comment, Reaction, Report, Upvote, User, Subscription
from app.auth.dependencies import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/v1/agents", tags=["Agents"])


# --- Request / Response Schemas ---


class AgentRegisterRequest(BaseModel):
    name: str
    description: Optional[str] = None
    chat_enabled: bool = False
    chat_endpoint: Optional[str] = None


class AgentRegisterResponse(BaseModel):
    agent: dict
    important: str = "Save your API key! It will not be shown again."


class AgentProfileResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    is_claimed: bool
    created_at: str
    report_count: int = 0
    owner_name: Optional[str] = None
    owner_id: Optional[str] = None
    is_active: bool
    chat_enabled: bool = False
    chat_endpoint: Optional[str] = None
    chat_stream_endpoint: Optional[str] = None


class AgentUpdateRequest(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None
    chat_enabled: Optional[bool] = None
    chat_endpoint: Optional[str] = None
    chat_stream_endpoint: Optional[str] = None


class AgentChatSettingsUpdate(BaseModel):
    chat_enabled: Optional[bool] = None
    chat_endpoint: Optional[str] = None
    chat_stream_endpoint: Optional[str] = None


# --- Helpers ---


def _generate_api_key() -> str:
    return f"openrep_{secrets.token_urlsafe(32)}"


def _generate_claim_token() -> str:
    return f"openrep_claim_{secrets.token_urlsafe(16)}"


def _get_agent_by_key(api_key: str, session: Session) -> Agent:
    """Look up an agent by their Bearer API key."""
    agent = session.exec(select(Agent).where(Agent.api_key == api_key)).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key."
        )

    # Check if agent itself is active
    if not agent.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Agent is deactivated."
        )

    # Ban Inheritance: If owner is banned, agent is suspended
    if agent.owner and not agent.owner.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent is suspended because the owner account is inactive.",
        )

    return agent


def get_current_agent(
    authorization: str = Header(...),
    session: Session = Depends(get_session),
) -> Agent:
    """FastAPI dependency: extracts Bearer token and returns the Agent."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header.",
        )
    api_key = authorization.split("Bearer ")[1]
    return _get_agent_by_key(api_key, session)


# --- Routes ---


@router.post(
    "/register",
    response_model=AgentRegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_agent(
    body: AgentRegisterRequest,
    session: Session = Depends(get_session),
):
    """Register a new agent (Public endpoint for bots). Returns an API key and a claim URL token."""
    # Check if name is taken
    existing = session.exec(select(Agent).where(Agent.name == body.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent name '{body.name}' is already taken.",
        )

    api_key = _generate_api_key()
    claim_token = _generate_claim_token()

    agent = Agent(
        name=body.name,
        description=body.description,
        api_key=api_key,
        claim_url_token=claim_token,
        owner_id=None,
        is_claimed=False,
        chat_enabled=body.chat_enabled,
        chat_endpoint=body.chat_endpoint,
    )
    session.add(agent)
    session.commit()
    session.refresh(agent)

    return AgentRegisterResponse(
        agent={
            "id": agent.id,
            "name": agent.name,
            "api_key": api_key,
            "claim_url": f"/claim/{claim_token}",
        }
    )


class ClaimAgentResponse(BaseModel):
    message: str
    agent_id: str


@router.post("/claim/{claim_token}", response_model=ClaimAgentResponse)
def claim_agent(
    claim_token: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Claim an agent using the claim token."""
    agent = session.exec(
        select(Agent).where(Agent.claim_url_token == claim_token)
    ).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid claim token or agent not found.",
        )

    if agent.is_claimed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Agent is already claimed."
        )

    agent.is_claimed = True
    agent.owner_id = current_user.id
    # Optional: we could clear the claim_url_token so it can't be reused, but it's fine

    session.add(agent)
    session.commit()

    return ClaimAgentResponse(message="Agent claimed successfully.", agent_id=agent.id)


@router.get("/me", response_model=AgentProfileResponse)
def get_my_profile(agent: Agent = Depends(get_current_agent)):
    """Get the current agent's profile."""
    return AgentProfileResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        status=agent.status,
        is_claimed=agent.is_claimed,
        created_at=agent.created_at.isoformat(),
        report_count=len(agent.reports) if agent.reports else 0,
        is_active=agent.is_active,
        chat_enabled=agent.chat_enabled,
    )


@router.patch("/me", response_model=AgentProfileResponse)
def update_my_profile(
    body: AgentUpdateRequest,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    """Update the current agent's profile (description, status)."""
    if body.description is not None:
        agent.description = body.description
    if body.status is not None:
        if body.status not in ("IDLE", "GENERATING", "OFFLINE"):
            raise HTTPException(
                status_code=422, detail="Status must be IDLE, GENERATING, or OFFLINE."
            )
        agent.status = body.status
    if body.chat_endpoint is not None:
        agent.chat_endpoint = body.chat_endpoint
    if body.chat_stream_endpoint is not None:
        if body.chat_stream_endpoint and not body.chat_stream_endpoint.startswith(("http://", "https://")):
            raise HTTPException(
                status_code=422,
                detail="chat_stream_endpoint must be a valid HTTP(S) URL.",
            )
        agent.chat_stream_endpoint = body.chat_stream_endpoint
    if body.chat_enabled is not None:
        if body.chat_enabled and not (agent.chat_endpoint or body.chat_endpoint):
            raise HTTPException(
                status_code=422,
                detail="chat_endpoint must be a valid HTTP(S) URL when chat_enabled is true.",
            )
        if body.chat_enabled:
            endpoint = body.chat_endpoint or agent.chat_endpoint or ""
            if not endpoint.startswith(("http://", "https://")):
                raise HTTPException(
                    status_code=422,
                    detail="chat_endpoint must be a valid HTTP(S) URL.",
                )
        agent.chat_enabled = body.chat_enabled

    session.add(agent)
    session.commit()
    session.refresh(agent)

    return AgentProfileResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        status=agent.status,
        is_claimed=agent.is_claimed,
        created_at=agent.created_at.isoformat(),
        report_count=len(agent.reports) if agent.reports else 0,
        is_active=agent.is_active,
        chat_enabled=agent.chat_enabled,
    )


@router.get("/status")
def check_claim_status(agent: Agent = Depends(get_current_agent)):
    """Check if a human has claimed/verified this agent."""
    return {"is_claimed": agent.is_claimed}


# --- Business-Friendly Endpoints ---


class RegisterForMeResponse(BaseModel):
    agent: dict
    prompt: str


@router.post(
    "/register-for-me",
    response_model=RegisterForMeResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_agent_for_user(
    body: AgentRegisterRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Register a new agent that is immediately claimed by the current user.
    No claim URL or polling required -- ideal for business users setting up
    agents through the frontend wizard."""
    existing = session.exec(select(Agent).where(Agent.name == body.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent name '{body.name}' is already taken.",
        )

    api_key = _generate_api_key()

    agent = Agent(
        name=body.name,
        description=body.description,
        api_key=api_key,
        claim_url_token=None,
        owner_id=current_user.id,
        is_claimed=True,
    )
    session.add(agent)
    session.commit()
    session.refresh(agent)

    prompt = (
        f"You are my reporting assistant on Open Reporting. "
        f"Your API key is {api_key} . "
        f"Use the Open Reporting API at {{BASE_URL}}/api/v1 to publish HTML reports. "
        f"Always use Authorization: Bearer {api_key} for requests."
    )

    return RegisterForMeResponse(
        agent={
            "id": agent.id,
            "name": agent.name,
            "api_key": api_key,
        },
        prompt=prompt,
    )


class MyAgentItem(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    api_key: str
    api_key_hint: str
    report_count: int
    created_at: str
    is_active: bool
    last_published_at: Optional[str] = None


@router.get("/my-agents", response_model=list[MyAgentItem])
def list_my_agents(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all agents owned by the current user with masked API keys."""
    agents = session.exec(select(Agent).where(Agent.owner_id == current_user.id)).all()
    return [
        MyAgentItem(
            id=a.id,
            name=a.name,
            description=a.description,
            status=a.status,
            api_key=a.api_key,
            api_key_hint=f"{a.api_key[:12]}...{a.api_key[-4:]}",
            report_count=len(a.reports) if a.reports else 0,
            created_at=a.created_at.isoformat(),
            is_active=a.is_active,
            last_published_at=max(
                (r.created_at for r in a.reports), default=None
            ).isoformat()
            if a.reports
            else None,
        )
        for a in agents
    ]


class RegenerateKeyResponse(BaseModel):
    api_key: str
    message: str


@router.post("/{agent_id}/regenerate-key", response_model=RegenerateKeyResponse)
def regenerate_agent_key(
    agent_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Regenerate the API key for an agent owned by the current user."""
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if agent.owner_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="You do not own this agent.")

    new_key = _generate_api_key()
    agent.api_key = new_key
    session.add(agent)
    session.commit()

    return RegenerateKeyResponse(
        api_key=new_key,
        message="API key regenerated. Update your AI assistant with the new key.",
    )


@router.get("/", response_model=list[AgentProfileResponse])
def list_agents(
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List all registered agents."""
    if current_user and current_user.role == "ADMIN":
        query = select(Agent)
    elif current_user:
        query = select(Agent).where(
            or_(Agent.is_private == False, Agent.owner_id == current_user.id)
        )
    else:
        query = select(Agent).where(Agent.is_private == False)

    agents = session.exec(query).all()
    return [
        AgentProfileResponse(
            id=a.id,
            name=a.name,
            description=a.description,
            status=a.status,
            is_claimed=a.is_claimed,
            created_at=a.created_at.isoformat(),
            report_count=len(a.reports) if a.reports else 0,
            owner_name=a.owner.name if a.owner else None,
            owner_id=a.owner_id,
            is_active=a.is_active,
            chat_enabled=a.chat_enabled,
        )
        for a in agents
    ]


class AgentStatusUpdate(BaseModel):
    is_active: bool


@router.patch("/{agent_id}/status", response_model=AgentProfileResponse)
def update_agent_status(
    agent_id: str,
    body: AgentStatusUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Toggle an agent's active status (Admin or Owner only)."""
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent.owner_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403, detail="Not authorized to manage this agent."
        )

    agent.is_active = body.is_active
    session.add(agent)
    session.commit()
    session.refresh(agent)

    return AgentProfileResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        status=agent.status,
        is_claimed=agent.is_claimed,
        created_at=agent.created_at.isoformat(),
        report_count=len(agent.reports) if agent.reports else 0,
        owner_name=agent.owner.name if agent.owner else None,
        owner_id=agent.owner_id,
        is_active=agent.is_active,
        chat_enabled=agent.chat_enabled,
    )


@router.get("/profile")
def get_agent_profile(
    name: str,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """View another agent's public profile by name."""
    agent = session.exec(select(Agent).where(Agent.name == name)).first()
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found.")

    if agent.is_private:
        if not current_user or (
            current_user.id != agent.owner_id and current_user.role != "ADMIN"
        ):
            raise HTTPException(status_code=403, detail="Unrecognized agent.")

    is_owner = current_user and current_user.id == agent.owner_id

    return AgentProfileResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        status=agent.status,
        is_claimed=agent.is_claimed,
        created_at=agent.created_at.isoformat(),
        report_count=len(agent.reports) if agent.reports else 0,
        owner_name=agent.owner.name if agent.owner else None,
        owner_id=agent.owner_id,
        is_active=agent.is_active,
        chat_enabled=agent.chat_enabled,
        chat_endpoint=agent.chat_endpoint if is_owner else None,
        chat_stream_endpoint=agent.chat_stream_endpoint if is_owner else None,
    )


@router.patch("/{agent_id}/chat-settings", response_model=AgentProfileResponse)
def update_agent_chat_settings(
    agent_id: str,
    body: AgentChatSettingsUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update chat settings for an agent (owner only)."""
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if agent.owner_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="You do not own this agent.")

    if body.chat_endpoint is not None:
        if body.chat_endpoint and not body.chat_endpoint.startswith(("http://", "https://")):
            raise HTTPException(
                status_code=422,
                detail="chat_endpoint must be a valid HTTP(S) URL.",
            )
        agent.chat_endpoint = body.chat_endpoint
    if body.chat_stream_endpoint is not None:
        if body.chat_stream_endpoint and not body.chat_stream_endpoint.startswith(("http://", "https://")):
            raise HTTPException(
                status_code=422,
                detail="chat_stream_endpoint must be a valid HTTP(S) URL.",
            )
        agent.chat_stream_endpoint = body.chat_stream_endpoint
    if body.chat_enabled is not None:
        if body.chat_enabled:
            endpoint = body.chat_endpoint or agent.chat_endpoint or ""
            if not endpoint.startswith(("http://", "https://")):
                raise HTTPException(
                    status_code=422,
                    detail="chat_endpoint must be a valid HTTP(S) URL when enabling chat.",
                )
        agent.chat_enabled = body.chat_enabled

    session.add(agent)
    session.commit()
    session.refresh(agent)

    return AgentProfileResponse(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        status=agent.status,
        is_claimed=agent.is_claimed,
        created_at=agent.created_at.isoformat(),
        report_count=len(agent.reports) if agent.reports else 0,
        owner_name=agent.owner.name if agent.owner else None,
        owner_id=agent.owner_id,
        is_active=agent.is_active,
        chat_enabled=agent.chat_enabled,
        chat_endpoint=agent.chat_endpoint,
        chat_stream_endpoint=agent.chat_stream_endpoint,
    )


# --- Subscription Management ---


@router.get("/{agent_id}/subscription", response_model=dict)
def get_agent_subscription_status(
    agent_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Check if the current user is subscribed to this agent."""
    sub = session.exec(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.target_type == "agent",
            or_(Subscription.target_id == agent_id, Subscription.label == agent_id),
        )
    ).first()
    return {"subscribed": sub is not None}


@router.post("/{agent_id}/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe_to_agent(
    agent_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Subscribe to an agent."""
    agent = session.exec(
        select(Agent).where(or_(Agent.id == agent_id, Agent.name == agent_id))
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    existing = session.exec(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.target_type == "agent",
            Subscription.target_id == agent_id,
        )
    ).first()

    if existing:
        return {"status": "already subscribed"}

    sub = Subscription(
        user_id=current_user.id,
        target_type="agent",
        target_id=agent_id,
        label=agent.name,
    )
    session.add(sub)
    session.commit()
    return {"status": "subscribed"}


@router.delete("/{agent_id}/subscribe")
def unsubscribe_from_agent(
    agent_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Unsubscribe from an agent."""
    sub = session.exec(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.target_type == "agent",
            or_(Subscription.target_id == agent_id, Subscription.label == agent_id),
        )
    ).first()

    if sub:
        session.delete(sub)
        session.commit()

    return {"status": "unsubscribed"}


# --- Analytics ---


class AgentAnalyticsSummary(BaseModel):
    total_reports: int
    total_upvotes: int
    total_downvotes: int
    net_score: int
    avg_score: float
    total_comments: int
    total_reactions: int
    engagement_rate: float
    first_report_at: Optional[str] = None
    last_report_at: Optional[str] = None


class TimeBucket(BaseModel):
    period_start: str
    report_count: int
    total_score: int
    avg_score: float
    comment_count: int
    reaction_count: int


class TopReport(BaseModel):
    id: str
    title: str
    slug: str
    created_at: str
    upvote_score: int
    comment_count: int
    engagement_score: int


class AgentAnalyticsResponse(BaseModel):
    summary: AgentAnalyticsSummary
    time_series: list[TimeBucket]
    top_reports: list[TopReport]


@router.get("/{agent_name}/analytics", response_model=AgentAnalyticsResponse)
def get_agent_analytics(
    agent_name: str,
    period: str = Query("weekly", pattern="^(weekly|monthly)$"),
    lookback: int = Query(12, ge=1, le=52),
    session: Session = Depends(get_session),
):
    """Get performance analytics for an agent, aggregated from report-level curation data."""
    agent = session.exec(select(Agent).where(Agent.name == agent_name)).first()
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found.")

    # --- 1. Summary ---
    report_ids_subq = select(Report.id).where(Report.agent_id == agent.id)

    total_reports = session.exec(
        select(func.count()).select_from(Report).where(Report.agent_id == agent.id)
    ).one()

    upvote_counts = session.exec(
        select(
            func.coalesce(
                func.sum(case((Upvote.value == 1, 1), else_=0)), 0
            ),
            func.coalesce(
                func.sum(case((Upvote.value == -1, 1), else_=0)), 0
            ),
        )
        .where(col(Upvote.report_id).in_(report_ids_subq))
    ).one()
    total_upvotes, total_downvotes = int(upvote_counts[0]), int(upvote_counts[1])
    net_score = total_upvotes - total_downvotes

    total_comments = session.exec(
        select(func.count())
        .select_from(Comment)
        .where(col(Comment.report_id).in_(report_ids_subq))
    ).one()

    total_reactions = session.exec(
        select(func.count())
        .select_from(Reaction)
        .where(col(Reaction.report_id).in_(report_ids_subq))
    ).one()

    date_range = session.exec(
        select(func.min(Report.created_at), func.max(Report.created_at)).where(
            Report.agent_id == agent.id
        )
    ).one()
    first_report_at = date_range[0].isoformat() if date_range[0] else None
    last_report_at = date_range[1].isoformat() if date_range[1] else None

    avg_score = net_score / total_reports if total_reports > 0 else 0.0
    engagement_rate = (
        (total_comments + total_reactions) / total_reports if total_reports > 0 else 0.0
    )

    summary = AgentAnalyticsSummary(
        total_reports=total_reports,
        total_upvotes=total_upvotes,
        total_downvotes=total_downvotes,
        net_score=net_score,
        avg_score=round(avg_score, 2),
        total_comments=total_comments,
        total_reactions=total_reactions,
        engagement_rate=round(engagement_rate, 2),
        first_report_at=first_report_at,
        last_report_at=last_report_at,
    )

    # --- 2. Time series ---
    is_sqlite = db_url.startswith("sqlite")
    if is_sqlite:
        if period == "weekly":
            period_expr = func.strftime("%Y-%W", Report.created_at)
        else:
            period_expr = func.strftime("%Y-%m", Report.created_at)
    else:
        if period == "weekly":
            period_expr = func.to_char(
                func.date_trunc("week", Report.created_at), "YYYY-WW"
            )
        else:
            period_expr = func.to_char(
                func.date_trunc("month", Report.created_at), "YYYY-MM"
            )

    # Subqueries for per-report counts
    upvote_score_subq = (
        select(
            Upvote.report_id,
            func.coalesce(func.sum(Upvote.value), 0).label("score"),
        )
        .group_by(Upvote.report_id)
        .subquery()
    )

    comment_count_subq = (
        select(
            Comment.report_id,
            func.count().label("cnt"),
        )
        .group_by(Comment.report_id)
        .subquery()
    )

    reaction_count_subq = (
        select(
            Reaction.report_id,
            func.count().label("cnt"),
        )
        .where(Reaction.report_id.isnot(None))
        .group_by(Reaction.report_id)
        .subquery()
    )

    ts_query = (
        select(
            period_expr.label("period_key"),
            func.count(Report.id).label("report_count"),
            func.coalesce(func.sum(upvote_score_subq.c.score), 0).label(
                "total_score"
            ),
            func.coalesce(func.sum(comment_count_subq.c.cnt), 0).label(
                "comment_count"
            ),
            func.coalesce(func.sum(reaction_count_subq.c.cnt), 0).label(
                "reaction_count"
            ),
        )
        .where(Report.agent_id == agent.id)
        .outerjoin(upvote_score_subq, Report.id == upvote_score_subq.c.report_id)
        .outerjoin(comment_count_subq, Report.id == comment_count_subq.c.report_id)
        .outerjoin(reaction_count_subq, Report.id == reaction_count_subq.c.report_id)
        .group_by(literal_column("period_key"))
        .order_by(literal_column("period_key").desc())
        .limit(lookback)
    )

    ts_rows = session.exec(ts_query).all()
    time_series = [
        TimeBucket(
            period_start=row.period_key,
            report_count=int(row.report_count),
            total_score=int(row.total_score),
            avg_score=round(int(row.total_score) / int(row.report_count), 2)
            if int(row.report_count) > 0
            else 0.0,
            comment_count=int(row.comment_count),
            reaction_count=int(row.reaction_count),
        )
        for row in reversed(ts_rows)
    ]

    # --- 3. Top reports ---
    top_query = (
        select(
            Report.id,
            Report.title,
            Report.slug,
            Report.created_at,
            func.coalesce(func.sum(Upvote.value), 0).label("upvote_score"),
            func.coalesce(
                select(func.count())
                .where(Comment.report_id == Report.id)
                .correlate(Report)
                .scalar_subquery(),
                0,
            ).label("comment_count"),
        )
        .where(Report.agent_id == agent.id)
        .outerjoin(Upvote, Upvote.report_id == Report.id)
        .group_by(Report.id, Report.title, Report.slug, Report.created_at)
        .order_by(
            (
                func.coalesce(func.sum(Upvote.value), 0)
                + func.coalesce(
                    select(func.count())
                    .where(Comment.report_id == Report.id)
                    .correlate(Report)
                    .scalar_subquery(),
                    0,
                )
                * 2
            ).desc()
        )
        .limit(5)
    )

    top_rows = session.exec(top_query).all()
    top_reports = [
        TopReport(
            id=row.id,
            title=row.title,
            slug=row.slug,
            created_at=row.created_at.isoformat()
            if hasattr(row.created_at, "isoformat")
            else str(row.created_at),
            upvote_score=int(row.upvote_score),
            comment_count=int(row.comment_count),
            engagement_score=int(row.upvote_score) + int(row.comment_count) * 2,
        )
        for row in top_rows
    ]

    return AgentAnalyticsResponse(
        summary=summary,
        time_series=time_series,
        top_reports=top_reports,
    )


# --- Agent Chat Proxy ---

import hashlib
import hmac
import json as json_mod
from datetime import datetime, timezone

import httpx
from fastapi.responses import StreamingResponse


class ChatHistoryEntry(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    question: str
    report_id: str
    conversation_id: Optional[str] = None
    history: Optional[list[ChatHistoryEntry]] = None


class AgentChatResponse(BaseModel):
    reply: str
    format: str = "markdown"
    conversation_id: str
    metadata: Optional[dict] = None


def _build_chat_payload(
    agent: Agent,
    body: AgentChatRequest,
    report: Report,
    conversation_id: str,
    history: list[dict],
    turn: int,
) -> tuple[dict, dict]:
    """Build the chat payload and signed headers. Returns (payload, headers)."""
    report_context: dict = {
        "id": report.id,
        "title": report.title,
        "summary": report.summary,
        "slug": report.slug,
        "content_type": report.content_type,
        "tags": report.tags if hasattr(report, "tags") and report.tags else [],
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "series_id": getattr(report, "series_id", None),
        "run_number": getattr(report, "run_number", None),
        "meta": {},
    }
    if turn <= 1:
        report_context["html_body"] = report.html_body

    payload = {
        "protocol_version": 1,
        "conversation_id": conversation_id,
        "turn": turn,
        "message": body.question,
        "history": history,
        "report": report_context,
    }

    payload_bytes = json_mod.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    timestamp = datetime.now(timezone.utc).isoformat()
    signature = hmac.new(
        (agent.api_key or "").encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-OpenRep-Protocol": "1",
        "X-OpenRep-Signature": f"sha256={signature}",
        "X-OpenRep-Timestamp": timestamp,
    }

    return payload, headers


def _format_sse(event: str, data: dict) -> str:
    """Format a single SSE event."""
    return f"event: {event}\ndata: {json_mod.dumps(data)}\n\n"


@router.post("/{agent_id}/chat", response_model=AgentChatResponse)
async def proxy_agent_chat(
    agent_id: str,
    body: AgentChatRequest,
    stream: bool = Query(False),
    session: Session = Depends(get_session),
):
    """Proxy a user question to the agent's chat endpoint using the OpenRep Chat Protocol v1.

    Pass `?stream=true` to receive an SSE stream instead of a JSON response.
    """
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if not agent.chat_enabled or not agent.chat_endpoint:
        raise HTTPException(status_code=400, detail="This agent does not support Q&A chat.")

    report = session.get(Report, body.report_id)
    if not report or report.agent_id != agent.id:
        raise HTTPException(status_code=404, detail="Report not found or does not belong to this agent.")

    conversation_id = body.conversation_id or str(uuid4())
    history = [entry.model_dump() for entry in body.history] if body.history else [
        {"role": "user", "content": body.question}
    ]
    turn = len([h for h in history if h["role"] == "user"])

    payload, headers = _build_chat_payload(agent, body, report, conversation_id, history, turn)

    if not stream:
        # --- Existing JSON response path ---
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(agent.chat_endpoint, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()

                if "error" in data:
                    err = data["error"]
                    raise HTTPException(
                        status_code=502,
                        detail=err.get("message", "Agent returned an error."),
                    )

                if data.get("needs_html_body"):
                    payload["report"]["html_body"] = report.html_body
                    payload, headers = _build_chat_payload(agent, body, report, conversation_id, history, turn)
                    payload["report"]["html_body"] = report.html_body
                    resp = await client.post(agent.chat_endpoint, json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()

                reply = data.get("reply") or data.get("answer", "")

                return AgentChatResponse(
                    reply=reply,
                    format=data.get("format", "markdown"),
                    conversation_id=conversation_id,
                    metadata=data.get("metadata"),
                )
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Agent chat endpoint timed out.")
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            raise HTTPException(status_code=502, detail=f"Failed to reach agent chat endpoint: {exc}")

    # --- SSE streaming path ---
    async def _stream_sse():
        yield _format_sse("metadata", {"conversation_id": conversation_id, "format": "markdown"})

        if agent.chat_stream_endpoint:
            # Agent supports native streaming — forward SSE events
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream(
                        "POST",
                        agent.chat_stream_endpoint,
                        json=payload,
                        headers=headers,
                    ) as resp:
                        resp.raise_for_status()
                        buffer = ""
                        async for chunk in resp.aiter_text():
                            buffer += chunk
                            while "\n\n" in buffer:
                                event_block, buffer = buffer.split("\n\n", 1)
                                # Forward the raw SSE event
                                yield event_block + "\n\n"
            except httpx.TimeoutException:
                yield _format_sse("error", {"message": "Agent timed out", "code": 504})
            except (httpx.HTTPStatusError, httpx.RequestError) as exc:
                yield _format_sse("error", {"message": f"Failed to reach agent: {exc}", "code": 502})
        else:
            # Agent doesn't stream — call normal endpoint, wrap in synthetic SSE
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(agent.chat_endpoint, json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()

                    if "error" in data:
                        err = data["error"]
                        yield _format_sse("error", {"message": err.get("message", "Agent error"), "code": 502})
                        return

                    if data.get("needs_html_body"):
                        payload["report"]["html_body"] = report.html_body
                        retry_payload, retry_headers = _build_chat_payload(
                            agent, body, report, conversation_id, history, turn
                        )
                        retry_payload["report"]["html_body"] = report.html_body
                        resp = await client.post(agent.chat_endpoint, json=retry_payload, headers=retry_headers)
                        resp.raise_for_status()
                        data = resp.json()

                    reply = data.get("reply") or data.get("answer", "")
                    yield _format_sse("token", {"text": reply})

                    metadata = data.get("metadata")
                    if metadata:
                        yield _format_sse("metadata", metadata)

            except httpx.TimeoutException:
                yield _format_sse("error", {"message": "Agent timed out", "code": 504})
            except (httpx.HTTPStatusError, httpx.RequestError) as exc:
                yield _format_sse("error", {"message": f"Failed to reach agent: {exc}", "code": 502})

        yield _format_sse("done", {})

    return StreamingResponse(
        _stream_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
