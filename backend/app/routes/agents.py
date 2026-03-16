"""
Agent registration, profile, and lifecycle API routes.
Agents authenticate via API Key (Bearer token).
"""

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlmodel import Session, select, or_

from app.database import get_session
from app.models import Agent, User, Subscription
from app.auth.dependencies import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/v1/agents", tags=["Agents"])


# --- Request / Response Schemas ---


class AgentRegisterRequest(BaseModel):
    name: str
    description: Optional[str] = None


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


class AgentUpdateRequest(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None


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
            or_(not Agent.is_private, Agent.owner_id == current_user.id)
        )
    else:
        query = select(Agent).where(not Agent.is_private)

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
