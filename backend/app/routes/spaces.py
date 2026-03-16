"""
Spaces (Sub-forums / Topics) API routes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, col, or_, select

from app.auth.dependencies import (
    get_current_user,
    get_current_user_optional,
    require_space_access,
)
from app.database import get_session
from app.models import (
    Favorite,
    Report,
    Space,
    SpaceAccess,
    SpaceGovernanceEvent,
    User,
    Subscription,
)

router = APIRouter(prefix="/api/v1/spaces", tags=["Spaces"])


# --- Schemas ---


class SpaceCreateRequest(BaseModel):
    name: str  # e.g. "o/marketing"
    description: Optional[str] = None
    is_private: bool = False


class SpaceUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None


class InviteRequest(BaseModel):
    user_email: str


class SpaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_private: bool
    owner_id: Optional[str]
    created_at: str
    report_count: int = 0
    member_count: int = 0


class SpaceStatsResponse(BaseModel):
    total_spaces: int
    total_reports: int
    total_memberships: int


class SpaceAccessResponse(BaseModel):
    user_id: str
    user_name: str
    user_email: str
    granted_at: str


class GovernanceEventResponse(BaseModel):
    id: str
    space_id: str
    space_name: Optional[str]
    action: str
    actor_user_id: Optional[str]
    actor_name: Optional[str]
    target_user_id: Optional[str]
    target_name: Optional[str]
    details: Optional[dict]
    created_at: str


# --- Helpers ---


def _normalize_space_name(name: str) -> str:
    normalized = name.strip()
    if not normalized.startswith("o/"):
        raise HTTPException(status_code=400, detail="Space name must start with 'o/'")
    return normalized


def _get_space_or_404(session: Session, space_id: str) -> Space:
    space = session.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    return space


def _ensure_space_manager(space: Space, current_user: User) -> None:
    if current_user.role != "ADMIN" and space.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to manage this space"
        )


def _report_count(session: Session, space_id: str) -> int:
    return int(
        session.exec(
            select(func.count(Report.id)).where(Report.space_id == space_id)
        ).one()
    )


def _member_count(session: Session, space: Space) -> int:
    if space.is_private:
        access_count = session.exec(
            select(func.count(SpaceAccess.id)).where(SpaceAccess.space_id == space.id)
        ).one()
        return int(access_count) + 1

    favorite_count = session.exec(
        select(func.count(Favorite.id)).where(
            Favorite.target_type == "space",
            Favorite.target_id == space.id,
        )
    ).one()
    return int(favorite_count) + 1


def _space_response(session: Session, space: Space) -> SpaceResponse:
    return SpaceResponse(
        id=space.id,
        name=space.name,
        description=space.description,
        is_private=space.is_private,
        owner_id=space.owner_id,
        created_at=space.created_at.isoformat(),
        report_count=_report_count(session, space.id),
        member_count=_member_count(session, space),
    )


def _record_space_event(
    session: Session,
    *,
    space: Space,
    action: str,
    actor: User,
    target_user_id: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    session.add(
        SpaceGovernanceEvent(
            space_id=space.id,
            space_name=space.name,
            action=action,
            actor_user_id=actor.id,
            target_user_id=target_user_id,
            details=details,
        )
    )


def _serialize_events(
    session: Session, events: list[SpaceGovernanceEvent]
) -> list[GovernanceEventResponse]:
    user_ids = {
        user_id
        for event in events
        for user_id in (event.actor_user_id, event.target_user_id)
        if user_id
    }
    users_by_id: dict[str, User] = {}
    if user_ids:
        users = session.exec(select(User).where(col(User.id).in_(user_ids))).all()
        users_by_id = {user.id: user for user in users}

    return [
        GovernanceEventResponse(
            id=event.id,
            space_id=event.space_id,
            space_name=event.space_name,
            action=event.action,
            actor_user_id=event.actor_user_id,
            actor_name=users_by_id[event.actor_user_id].name
            if event.actor_user_id in users_by_id
            else None,
            target_user_id=event.target_user_id,
            target_name=users_by_id[event.target_user_id].name
            if event.target_user_id in users_by_id
            else None,
            details=event.details,
            created_at=event.created_at.isoformat(),
        )
        for event in events
    ]


# --- Routes ---


@router.post("/", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
def create_space(
    body: SpaceCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new space (sub-forum)."""
    normalized_name = _normalize_space_name(body.name)
    existing = session.exec(select(Space).where(Space.name == normalized_name)).first()
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Space '{normalized_name}' already exists."
        )

    space = Space(
        name=normalized_name,
        description=body.description,
        is_private=body.is_private,
        owner_id=current_user.id,
    )
    session.add(space)
    _record_space_event(
        session,
        space=space,
        action="space_created",
        actor=current_user,
        details={"is_private": body.is_private},
    )
    session.commit()
    session.refresh(space)
    return _space_response(session, space)


@router.get("/stats", response_model=SpaceStatsResponse)
def get_space_stats(session: Session = Depends(get_session)):
    """Get global platform-wide statistics."""
    total_spaces = int(session.exec(select(func.count(Space.id))).one())
    total_reports = int(session.exec(select(func.count(Report.id))).one())
    total_favorites = int(
        session.exec(
            select(func.count(Favorite.id)).where(Favorite.target_type == "space")
        ).one()
    )
    total_private_accesses = int(session.exec(select(func.count(SpaceAccess.id))).one())
    total_memberships = total_favorites + total_private_accesses + total_spaces

    return SpaceStatsResponse(
        total_spaces=total_spaces,
        total_reports=total_reports,
        total_memberships=total_memberships,
    )


@router.get("/governance-events/recent", response_model=list[GovernanceEventResponse])
def list_recent_governance_events(
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List recent governance events platform-wide (admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403, detail="Not authorized to view governance events"
        )

    events = session.exec(
        select(SpaceGovernanceEvent)
        .order_by(SpaceGovernanceEvent.created_at.desc())
        .limit(limit)
    ).all()
    return _serialize_events(session, events)


@router.get("/", response_model=list[SpaceResponse])
def list_spaces(
    sort: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List spaces the current user can access."""
    if current_user and current_user.role == "ADMIN":
        query = select(Space)
    elif current_user:
        access_sq = select(SpaceAccess.space_id).where(
            SpaceAccess.user_id == current_user.id
        )
        query = select(Space).where(
            or_(
                Space.is_private == False,  # noqa: E712
                Space.owner_id == current_user.id,
                col(Space.id).in_(access_sq),
            )
        )
    else:
        query = select(Space).where(Space.is_private == False)  # noqa: E712

    spaces = session.exec(query).all()

    if sort == "popularity":
        spaces = sorted(
            spaces, key=lambda s: _report_count(session, s.id), reverse=True
        )
    else:
        spaces = sorted(spaces, key=lambda s: s.name)

    return [_space_response(session, space) for space in spaces]


@router.get("/{space_id}", response_model=SpaceResponse)
def get_space(
    space: Space = Depends(require_space_access),
    session: Session = Depends(get_session),
):
    """Get details of a specific space."""
    return _space_response(session, space)


@router.get("/{space_id}/subscription")
def get_space_subscription_status(
    space_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Check if the user is subscribed to this space."""
    sub = session.exec(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.target_type == "space",
            Subscription.target_id == space_id,
        )
    ).first()
    return {"subscribed": sub is not None}


@router.get(
    "/{space_id}/governance-events", response_model=list[GovernanceEventResponse]
)
def list_space_governance_events(
    space_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List governance events for one space (space owner or admin)."""
    space = _get_space_or_404(session, space_id)
    _ensure_space_manager(space, current_user)
    events = session.exec(
        select(SpaceGovernanceEvent)
        .where(SpaceGovernanceEvent.space_id == space_id)
        .order_by(SpaceGovernanceEvent.created_at.desc())
        .limit(limit)
    ).all()
    return _serialize_events(session, events)


# --- Access Management ---


@router.get("/{space_id}/access", response_model=list[SpaceAccessResponse])
def list_space_access(
    space_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List users who have explicitly been granted access to a private space."""
    space = _get_space_or_404(session, space_id)
    _ensure_space_manager(space, current_user)
    accesses = session.exec(
        select(SpaceAccess, User).join(User).where(SpaceAccess.space_id == space_id)
    ).all()
    return [
        SpaceAccessResponse(
            user_id=user.id,
            user_name=user.name,
            user_email=user.email,
            granted_at=access.created_at.isoformat(),
        )
        for access, user in accesses
    ]


@router.post("/{space_id}/invite", response_model=SpaceAccessResponse)
def invite_user_to_space(
    space_id: str,
    body: InviteRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Invite a user to a private space."""
    space = _get_space_or_404(session, space_id)
    _ensure_space_manager(space, current_user)

    if not space.is_private:
        raise HTTPException(
            status_code=400, detail="Public spaces do not require invites"
        )

    target_user = session.exec(
        select(User).where(User.email == body.user_email.strip())
    ).first()
    if not target_user:
        raise HTTPException(
            status_code=404, detail=f"User with email '{body.user_email}' not found"
        )
    if target_user.id == space.owner_id:
        raise HTTPException(status_code=409, detail="Space owner already has access")

    existing = session.exec(
        select(SpaceAccess).where(
            SpaceAccess.space_id == space_id,
            SpaceAccess.user_id == target_user.id,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=409, detail="User already has access to this space"
        )

    access = SpaceAccess(space_id=space.id, user_id=target_user.id)
    session.add(access)
    _record_space_event(
        session,
        space=space,
        action="member_invited",
        actor=current_user,
        target_user_id=target_user.id,
    )
    session.commit()
    session.refresh(access)

    return SpaceAccessResponse(
        user_id=target_user.id,
        user_name=target_user.name,
        user_email=target_user.email,
        granted_at=access.created_at.isoformat(),
    )


@router.patch("/{space_id}", response_model=SpaceResponse)
def update_space(
    space_id: str,
    body: SpaceUpdateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update space details (owner or admin)."""
    space = _get_space_or_404(session, space_id)
    _ensure_space_manager(space, current_user)

    changes: dict[str, dict[str, Optional[str] | bool]] = {}

    if body.name is not None:
        next_name = _normalize_space_name(body.name)
        if next_name != space.name:
            duplicate = session.exec(
                select(Space).where(Space.name == next_name, Space.id != space.id)
            ).first()
            if duplicate:
                raise HTTPException(
                    status_code=409, detail=f"Space '{next_name}' already exists."
                )
            changes["name"] = {"from": space.name, "to": next_name}
            space.name = next_name

    if body.description is not None and body.description != space.description:
        changes["description"] = {"from": space.description, "to": body.description}
        space.description = body.description

    if body.is_private is not None and body.is_private != space.is_private:
        changes["is_private"] = {"from": space.is_private, "to": body.is_private}
        space.is_private = body.is_private

    session.add(space)
    if changes:
        _record_space_event(
            session,
            space=space,
            action="space_updated",
            actor=current_user,
            details=changes,
        )
    session.commit()
    session.refresh(space)
    return _space_response(session, space)


@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_space(
    space_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete a space (owner or admin)."""
    space = _get_space_or_404(session, space_id)
    _ensure_space_manager(space, current_user)

    _record_space_event(
        session,
        space=space,
        action="space_deleted",
        actor=current_user,
        details={
            "space_name": space.name,
            "report_count": _report_count(session, space.id),
            "member_count": _member_count(session, space),
        },
    )
    session.delete(space)
    session.commit()
    return None


@router.delete("/{space_id}/access/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_space_access(
    space_id: str,
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Revoke a user's explicit access to a space (owner or admin)."""
    space = _get_space_or_404(session, space_id)
    _ensure_space_manager(space, current_user)

    if user_id == space.owner_id:
        raise HTTPException(
            status_code=400, detail="Cannot revoke access from the space owner"
        )

    access = session.exec(
        select(SpaceAccess).where(
            SpaceAccess.space_id == space_id,
            SpaceAccess.user_id == user_id,
        )
    ).first()
    if not access:
        raise HTTPException(
            status_code=404, detail="User does not have explicit access to this space"
        )

    session.delete(access)
    _record_space_event(
        session,
        space=space,
        action="member_revoked",
        actor=current_user,
        target_user_id=user_id,
    )
    session.commit()
    return None
