"""
Authentication routes for Open Reporting.
"""

import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, Annotated
from sqlmodel import Session, select

from app.database import get_session
from app.models import User, Favorite, Subscription, RefreshToken
from app.auth.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
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
    refresh_token: str
    token_type: str


class RefreshRequest(BaseModel):
    refresh_token: str


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


class UserStats(BaseModel):
    comments_count: int
    favorites_count: int
    upvotes_given: int
    reports_viewed: int


# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------


@router.post("/register", response_model=Token)
def register(user_in: UserRegister, session: Session = Depends(get_session)):
    """Register a new user and return access + refresh tokens."""
    user = session.exec(select(User).where(User.email == user_in.email)).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="Registration failed. Please check your input and try again.",
        )

    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=hashed_password,
        provider="local",
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.id})
    raw_refresh, refresh_hash = create_refresh_token()
    rt = RefreshToken(
        user_id=new_user.id,
        token_hash=refresh_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    session.add(rt)
    session.commit()

    return Token(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
    )


@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Session = Depends(get_session),
):
    """
    OAuth2 compatible token login, get access + refresh tokens for future requests.
    """
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token = create_access_token(data={"sub": user.id})
    raw_refresh, refresh_hash = create_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    session.add(rt)
    session.commit()

    return Token(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
    )


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


@router.get("/me/stats", response_model=UserStats)
def get_my_stats(current_user: User = Depends(get_current_user)):
    """Get activity stats for the current user."""
    return UserStats(
        comments_count=len(current_user.comments),
        favorites_count=len(current_user.favorites),
        upvotes_given=len(current_user.upvotes),
        reports_viewed=0,
    )


# ---------------------------------------------------------------------------
# Token Refresh & Logout
# ---------------------------------------------------------------------------


@router.post("/refresh", response_model=Token)
def refresh_access_token(body: RefreshRequest, session: Session = Depends(get_session)):
    """Exchange a valid refresh token for new access + refresh tokens (rotation)."""
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()

    stored = session.exec(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
        )
    ).first()

    if not stored or stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = session.get(User, stored.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or deactivated")

    # Revoke the old refresh token
    stored.revoked = True
    session.add(stored)

    # Issue new token pair
    access_token = create_access_token(data={"sub": user.id})
    new_raw, new_hash = create_refresh_token()
    new_rt = RefreshToken(
        user_id=user.id,
        token_hash=new_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    session.add(new_rt)
    session.commit()

    return Token(
        access_token=access_token,
        refresh_token=new_raw,
        token_type="bearer",
    )


@router.post("/logout")
def logout(body: RefreshRequest, session: Session = Depends(get_session)):
    """Revoke a refresh token (log out)."""
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    stored = session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).first()
    if stored:
        stored.revoked = True
        session.add(stored)
        session.commit()
    return {"message": "Logged out"}


# ---------------------------------------------------------------------------
# Favorites Endpoints
# ---------------------------------------------------------------------------


@router.get("/me/favorites", response_model=list[FavoriteSchema])
def get_favorites(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """List the current user's favorites."""
    favorites = session.exec(
        select(Favorite).where(Favorite.user_id == current_user.id)
    ).all()

    return [
        FavoriteSchema(
            id=f.id, target_type=f.target_type, target_id=f.target_id, label=f.label
        )
        for f in favorites
    ]


@router.post("/me/favorites", response_model=FavoriteSchema)
def toggle_favorite(
    body: FavoriteToggle,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
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
            id=existing.id,
            target_type=existing.target_type,
            target_id=existing.target_id,
            label=existing.label,
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
        id=fav.id, target_type=fav.target_type, target_id=fav.target_id, label=fav.label
    )


# ---------------------------------------------------------------------------
# Subscription Endpoints
# ---------------------------------------------------------------------------


@router.get("/me/subscriptions", response_model=list[SubscriptionSchema])
def get_subscriptions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """List the current user's subscriptions."""
    subscriptions = session.exec(
        select(Subscription).where(Subscription.user_id == current_user.id)
    ).all()

    return [
        SubscriptionSchema(
            id=s.id, target_type=s.target_type, target_id=s.target_id, label=s.label
        )
        for s in subscriptions
    ]


@router.post("/me/subscriptions", response_model=SubscriptionSchema)
def toggle_subscription(
    body: SubscriptionToggle,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
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
            id=existing.id,
            target_type=existing.target_type,
            target_id=existing.target_id,
            label=existing.label,
        )

    sub = Subscription(
        user_id=current_user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        label=body.label,
    )
    session.add(sub)
    session.commit()
    session.refresh(sub)

    return SubscriptionSchema(
        id=sub.id, target_type=sub.target_type, target_id=sub.target_id, label=sub.label
    )
