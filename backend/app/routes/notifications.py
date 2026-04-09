from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_session
from app.models import NotificationPreference, User, Notification
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: str
    text: str
    link: str
    is_read: bool
    created_at: datetime


@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Fetch the current user's notifications."""
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )

    notifications = session.exec(stmt).all()
    return notifications


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Mark a specific notification as read."""
    stmt = select(Notification).where(
        Notification.id == notification_id, Notification.user_id == current_user.id
    )
    notification = session.exec(stmt).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    session.add(notification)
    session.commit()

    return {"status": "ok"}


@router.post("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Mark all notifications of current user as read."""
    stmt = select(Notification).where(
        Notification.user_id == current_user.id, Notification.is_read.is_(False)
    )
    notifications = session.exec(stmt).all()

    for n in notifications:
        n.is_read = True
        session.add(n)

    session.commit()
    return {"status": "ok", "count": len(notifications)}


class NotificationPreferencePut(BaseModel):
    channel: str
    enabled: bool
    webhook_url: Optional[str] = None
    events: List[str] = []


class NotificationPreferenceResponse(BaseModel):
    id: str
    channel: str
    enabled: bool
    webhook_url: Optional[str] = None
    events: List[str] = []


@router.get("/preferences", response_model=List[NotificationPreferenceResponse])
def get_preferences(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    stmt = select(NotificationPreference).where(
        NotificationPreference.user_id == current_user.id
    )
    prefs = session.exec(stmt).all()

    return [
        NotificationPreferenceResponse(
            id=p.id,
            channel=p.channel,
            enabled=p.enabled,
            webhook_url=p.webhook_url,
            events=p.events if isinstance(p.events, list) else [],
        )
        for p in prefs
    ]


@router.put("/preferences", response_model=NotificationPreferenceResponse)
def update_preference(
    pref_data: NotificationPreferencePut,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Support upsert logic for preference by channel
    stmt = select(NotificationPreference).where(
        NotificationPreference.user_id == current_user.id,
        NotificationPreference.channel == pref_data.channel,
    )
    pref = session.exec(stmt).first()

    if not pref:
        pref = NotificationPreference(
            user_id=current_user.id,
            channel=pref_data.channel,
            enabled=pref_data.enabled,
            webhook_url=pref_data.webhook_url,
            events=pref_data.events,
        )
        session.add(pref)
    else:
        pref.enabled = pref_data.enabled
        pref.webhook_url = pref_data.webhook_url
        pref.events = pref_data.events
        session.add(pref)

    session.commit()
    session.refresh(pref)

    return NotificationPreferenceResponse(
        id=pref.id,
        channel=pref.channel,
        enabled=pref.enabled,
        webhook_url=pref.webhook_url,
        events=pref.events if isinstance(pref.events, list) else [],
    )
