from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlmodel import Session, select, or_
import shutil
import uuid

from app.database import get_session
from app.models import User
from app.auth.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/api/v1/users", tags=["Users"])

# --- Schemas ---

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class UserRoleUpdate(BaseModel):
    role: str

class UserProfilePublic(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: datetime
    avatar_url: Optional[str] = None
    provider: str

# --- Routes ---

@router.patch("/me", response_model=UserProfilePublic)
def update_my_profile(
    body: UserProfileUpdate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update profile settings for the authenticated user."""
    if body.name is not None:
        current_user.name = body.name
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url
        
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    
    return UserProfilePublic(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        avatar_url=current_user.avatar_url,
        provider=current_user.provider
    )

@router.post("/me/avatar", response_model=UserProfilePublic)
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Upload a new avatar logic."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    from app.core.storage import upload_file
    public_url = await upload_file(file, request=request, folder="avatars")
    
    if not public_url:
        raise HTTPException(status_code=500, detail="Storage is not configured correctly on the server")
        
    current_user.avatar_url = public_url
    
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    
    return UserProfilePublic(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        avatar_url=current_user.avatar_url,
        provider=current_user.provider
    )

@router.get("/", response_model=List[UserProfilePublic])
def list_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """List all registered users (Admin only)."""
    users = session.exec(select(User)).all()
    return [
        UserProfilePublic(
            id=u.id, name=u.name, email=u.email, 
            role=u.role, created_at=u.created_at, avatar_url=u.avatar_url, provider=u.provider
        ) 
        for u in users
    ]

@router.get("/search", response_model=List[UserProfilePublic])
def search_users(
    q: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Search users by name or email (for inviting to spaces)."""
    query = select(User).where(or_(
        User.name.icontains(q),
        User.email.icontains(q)
    )).limit(10)
    
    users = session.exec(query).all()
    return [
        UserProfilePublic(
            id=u.id, name=u.name, email=u.email, 
            role=u.role, created_at=u.created_at, avatar_url=u.avatar_url, provider=u.provider
        ) 
        for u in users
    ]

@router.patch("/{user_id}/role", response_model=UserProfilePublic)
def update_user_role(
    user_id: str,
    body: UserRoleUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin)
):
    """Update a user's role (Admin only)."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if body.role not in ["USER", "ADMIN"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    user.role = body.role
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return UserProfilePublic(
        id=user.id, name=user.name, email=user.email, 
        role=user.role, created_at=user.created_at, 
        avatar_url=user.avatar_url, provider=user.provider
    )
