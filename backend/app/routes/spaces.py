"""
Spaces (Sub-forums / Topics) API routes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, col, or_

from app.database import get_session
from app.models import Space, SpaceAccess, User, Favorite
from app.auth.dependencies import get_current_user, get_current_user_optional, require_space_access

router = APIRouter(prefix="/api/v1/spaces", tags=["Spaces"])


# --- Schemas ---

class SpaceCreateRequest(BaseModel):
    name: str  # e.g. "o/marketing"
    description: Optional[str] = None
    is_private: bool = False

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


# --- Routes ---

@router.post("/", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
def create_space(
    body: SpaceCreateRequest, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new space (sub-forum)."""
    existing = session.exec(select(Space).where(Space.name == body.name)).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Space '{body.name}' already exists.")

    space = Space(name=body.name, description=body.description, is_private=body.is_private, owner_id=current_user.id)
    session.add(space)
    session.commit()
    session.refresh(space)

    return SpaceResponse(
        is_private=space.is_private, owner_id=space.owner_id,
        created_at=space.created_at.isoformat(),
        report_count=0,
        member_count=1 # Owner is the first member
    )


@router.get("/stats", response_model=SpaceStatsResponse)
def get_space_stats(session: Session = Depends(get_session)):
    """Get global platform-wide statistics."""
    from app.models import Report
    from sqlalchemy import func
    
    total_spaces = session.exec(select(func.count(Space.id))).one()
    total_reports = session.exec(select(func.count(Report.id))).one()
    # Total memberships = Total space favorites + Total number of spaces (owners)
    total_favs = session.exec(select(func.count(Favorite.id)).where(Favorite.target_type == "space")).one()
    total_memberships = total_favs + total_spaces
    
    return SpaceStatsResponse(
        total_spaces=total_spaces,
        total_reports=total_reports,
        total_memberships=total_memberships
    )


@router.get("/", response_model=list[SpaceResponse])
def list_spaces(
    sort: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """List all spaces the user has access to."""
    from sqlalchemy import func
    from app.models import Report

    # Subqueries for counts
    count_sq = select(Report.space_id, func.count(Report.id).label("cnt")).group_by(Report.space_id).subquery()
    report_count_expr = func.coalesce(count_sq.c.cnt, 0).label("report_count")

    member_sq = select(Favorite.target_id, func.count(Favorite.id).label("m_cnt")).where(Favorite.target_type == "space").group_by(Favorite.target_id).subquery()
    member_count_expr = (func.coalesce(member_sq.c.m_cnt, 0) + 1).label("member_count")

    if current_user and current_user.role == "ADMIN":
        query = select(Space, report_count_expr, member_count_expr).outerjoin(count_sq, Space.id == count_sq.c.space_id).outerjoin(member_sq, Space.id == member_sq.c.target_id)
    elif current_user:
        access_sq = select(SpaceAccess.space_id).where(SpaceAccess.user_id == current_user.id)
        query = select(Space, report_count_expr, member_count_expr).outerjoin(count_sq, Space.id == count_sq.c.space_id).outerjoin(member_sq, Space.id == member_sq.c.target_id).where(or_(
            Space.is_private == False,
            Space.owner_id == current_user.id,
            col(Space.id).in_(access_sq)
        ))
    else:
        query = select(Space, report_count_expr, member_count_expr).outerjoin(count_sq, Space.id == count_sq.c.space_id).outerjoin(member_sq, Space.id == member_sq.c.target_id).where(Space.is_private == False)
    
    if sort == "popularity":
        # Popularity is a mix of reports and members (just using reports for now as per previous logic)
        query = query.order_by(report_count_expr.desc())
    else:
        query = query.order_by(Space.name)
        
    results = session.exec(query).all()
    
    return [
        SpaceResponse(
            id=s.id, name=s.name, description=s.description,
            is_private=s.is_private, owner_id=s.owner_id,
            created_at=s.created_at.isoformat(),
            report_count=rc,
            member_count=mc
        )
        for s, rc, mc in results
    ]


@router.get("/{space_id}", response_model=SpaceResponse)
def get_space(space: Space = Depends(require_space_access), session: Session = Depends(get_session)):
    """Get details of a specific space."""
    from app.models import Report, Favorite
    from sqlalchemy import func
    rc_cnt = session.exec(select(func.count(Report.id)).where(Report.space_id == space.id)).one()
    # Member count = number of people who favorited it + 1 for the owner
    fav_cnt = session.exec(select(func.count(Favorite.id)).where(Favorite.target_type == "space", Favorite.target_id == space.id)).one()
    m_cnt = fav_cnt + 1
    
    return SpaceResponse(
        id=space.id, name=space.name, description=space.description,
        is_private=space.is_private, owner_id=space.owner_id,
        created_at=space.created_at.isoformat(),
        report_count=rc_cnt,
        member_count=m_cnt
    )


# --- Access Management ---

class SpaceAccessResponse(BaseModel):
    user_id: str
    user_name: str
    user_email: str
    granted_at: str

class InviteRequest(BaseModel):
    user_email: str

@router.get("/{space_id}/access", response_model=list[SpaceAccessResponse])
def list_space_access(
    space_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List users who have explicitly been granted access to a private space."""
    space = session.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
        
    # Only Space Owner or Admin can view access list
    if current_user.role != "ADMIN" and space.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view space access")
        
    accesses = session.exec(
        select(SpaceAccess, User)
        .join(User)
        .where(SpaceAccess.space_id == space_id)
    ).all()
    
    return [
        SpaceAccessResponse(
            user_id=user.id,
            user_name=user.name,
            user_email=user.email,
            granted_at=access.created_at.isoformat()
        )
        for access, user in accesses
    ]

@router.post("/{space_id}/invite", response_model=SpaceAccessResponse)
def invite_user_to_space(
    space_id: str,
    body: InviteRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Invite a user to a private space."""
    space = session.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
        
    # Only allow Owner or Admin to invite
    if current_user.role != "ADMIN" and space.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to invite users to this space")
        
    # Find the user to invite
    target_user = session.exec(select(User).where(User.email == body.user_email)).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User with email '{body.user_email}' not found")
        
    # Check if already has access
    existing = session.exec(
        select(SpaceAccess)
        .where(SpaceAccess.space_id == space_id, SpaceAccess.user_id == target_user.id)
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="User already has access to this space")
        
    access = SpaceAccess(space_id=space.id, user_id=target_user.id)
    session.add(access)
    session.commit()
    session.refresh(access)
    
    return SpaceAccessResponse(
        user_id=target_user.id,
        user_name=target_user.name,
        user_email=target_user.email,
        granted_at=access.created_at.isoformat()
    )


@router.patch("/{space_id}", response_model=SpaceResponse)
def update_space(
    space_id: str,
    body: SpaceCreateRequest, # Reusing same fields for now (name, description, is_private)
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update space details (owner or admin)."""
    space = session.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
        
    if current_user.role != "ADMIN" and space.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this space")
        
    if body.name is not None:
        space.name = body.name
    if body.description is not None:
        space.description = body.description
    if body.is_private is not None:
        space.is_private = body.is_private
        
    session.add(space)
    session.commit()
    session.refresh(space)
    return SpaceResponse(
        id=space.id, name=space.name, description=space.description,
        is_private=space.is_private, created_at=space.created_at.isoformat(),
        report_count=0,
        member_count=0
    )


@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_space(
    space_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a space (owner or admin)."""
    space = session.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
        
    if current_user.role != "ADMIN" and space.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this space")
        
    session.delete(space)
    session.commit()
    return None


@router.delete("/{space_id}/access/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_space_access(
    space_id: str,
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Revoke a user's access to a private space (owner or admin)."""
    space = session.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
        
    if current_user.role != "ADMIN" and space.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to manage access for this space")
        
    access = session.exec(
        select(SpaceAccess)
        .where(SpaceAccess.space_id == space_id, SpaceAccess.user_id == user_id)
    ).first()
    
    if access:
        session.delete(access)
        session.commit()
        
    return None
