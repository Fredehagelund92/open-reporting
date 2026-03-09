"""
Authentication routes for Open Reporting.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, Annotated
from datetime import datetime
from sqlmodel import Session, select

from app.database import get_session
from app.models import User, Favorite, Subscription
from app.auth.security import get_password_hash, verify_password, create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: datetime
    avatar_url: Optional[str] = None
    provider: str

class FavoriteSchema(BaseModel):
    id: str
    target_type: str
    target_id: str
    label: str

class FavoriteToggle(BaseModel):
    target_type: str  # "space" or "report"
    target_id: str
    label: str

class SubscriptionSchema(BaseModel):
    id: str
    target_type: str
    target_id: str
    label: str

class SubscriptionToggle(BaseModel):
    target_type: str  # "space" or "agent"
    target_id: str
    label: str

# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=UserProfile)
def register(user_in: UserRegister, session: Session = Depends(get_session)):
    """Register a new user."""
    user = session.exec(select(User).where(User.email == user_in.email)).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=hashed_password,
        provider="local"
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    return UserProfile(
        id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        role=new_user.role,
        created_at=new_user.created_at,
        avatar_url=new_user.avatar_url,
        provider=new_user.provider,
    )

@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Session = Depends(get_session)
):
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserProfile)
def read_users_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserProfile(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        created_at=current_user.created_at,
        avatar_url=current_user.avatar_url,
        provider=current_user.provider,
    )


# ---------------------------------------------------------------------------
# Favorites Endpoints
# ---------------------------------------------------------------------------

@router.get("/me/favorites", response_model=list[FavoriteSchema])
def get_favorites(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """List the current user's favorites."""
    favorites = session.exec(
        select(Favorite).where(Favorite.user_id == current_user.id)
    ).all()

    return [
        FavoriteSchema(
            id=f.id, target_type=f.target_type,
            target_id=f.target_id, label=f.label
        )
        for f in favorites
    ]

@router.post("/me/favorites", response_model=FavoriteSchema)
def toggle_favorite(body: FavoriteToggle, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Toggle a favorite. If it exists, remove it; otherwise, add it."""
    existing = session.exec(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.target_type == body.target_type,
            Favorite.target_id == body.target_id,
        )
    ).first()

    if existing:
        session.delete(existing)
        session.commit()
        return FavoriteSchema(
            id=existing.id, target_type=existing.target_type,
            target_id=existing.target_id, label=existing.label
        )

    fav = Favorite(
        user_id=current_user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        label=body.label,
    )
    session.add(fav)
    session.commit()
    session.refresh(fav)

    return FavoriteSchema(
        id=fav.id, target_type=fav.target_type,
        target_id=fav.target_id, label=fav.label
    )


# ---------------------------------------------------------------------------
# Subscription Endpoints
# ---------------------------------------------------------------------------

@router.get("/me/subscriptions", response_model=list[SubscriptionSchema])
def get_subscriptions(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """List the current user's subscriptions."""
    subscriptions = session.exec(
        select(Subscription).where(Subscription.user_id == current_user.id)
    ).all()

    return [
        SubscriptionSchema(
            id=s.id, target_type=s.target_type,
            target_id=s.target_id,
            label=s.label
        )
        for s in subscriptions
    ]

@router.post("/me/subscriptions", response_model=SubscriptionSchema)
def toggle_subscription(body: SubscriptionToggle, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Toggle a subscription. If it exists, remove it; otherwise, add it."""
    existing = session.exec(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.target_type == body.target_type,
            Subscription.target_id == body.target_id,
        )
    ).first()

    if existing:
        session.delete(existing)
        session.commit()
        return SubscriptionSchema(
            id=existing.id, target_type=existing.target_type,
            target_id=existing.target_id,
            label=existing.label
        )

    sub = Subscription(
        user_id=current_user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        label=body.label
    )
    session.add(sub)
    session.commit()
    session.refresh(sub)

    return SubscriptionSchema(
        id=sub.id,
        target_type=sub.target_type,
        target_id=sub.target_id,
        label=sub.label
    )
