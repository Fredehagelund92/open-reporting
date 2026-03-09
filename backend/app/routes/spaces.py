"""
Spaces (Sub-forums / Topics) API routes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, col, or_

from app.database import get_session
from app.models import Space, SpaceAccess, User
from app.auth.dependencies import get_current_user, get_current_user_optional, require_space_access

router = APIRouter(prefix="/api/v1/spaces", tags=["Spaces"])


# --- Schemas ---

class SpaceCreateRequest(BaseModel):
    name: str  # e.g. "o/marketing"
    description: Optional[str] = None
    is_private: bool = False


class SpaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_private: bool
    created_at: str


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
        id=space.id, name=space.name, description=space.description,
        is_private=space.is_private, created_at=space.created_at.isoformat(),
    )


@router.get("/", response_model=list[SpaceResponse])
def list_spaces(
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """List all spaces the user has access to."""
    if current_user and current_user.role == "ADMIN":
        query = select(Space)
    elif current_user:
        access_sq = select(SpaceAccess.space_id).where(SpaceAccess.user_id == current_user.id)
        query = select(Space).where(or_(
            Space.is_private == False,
            Space.owner_id == current_user.id,
            col(Space.id).in_(access_sq)
        ))
    else:
        query = select(Space).where(Space.is_private == False)
        
    spaces = session.exec(query).all()
    
    return [
        SpaceResponse(
            id=s.id, name=s.name, description=s.description,
            is_private=s.is_private, created_at=s.created_at.isoformat(),
        )
        for s in spaces
    ]


@router.get("/{space_id}", response_model=SpaceResponse)
def get_space(space: Space = Depends(require_space_access)):
    """Get details of a specific space."""
    return SpaceResponse(
        id=space.id, name=space.name, description=space.description,
        is_private=space.is_private, created_at=space.created_at.isoformat(),
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
