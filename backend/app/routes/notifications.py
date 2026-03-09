from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from sqlmodel import Session, select, col
from datetime import datetime

from app.database import get_session
from app.models import Notification, User
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])

class NotificationResponse(BaseModel):
    id: str
    text: str
    link: str
    is_read: bool
    created_at: datetime

@router.get("/", response_model=List[NotificationResponse])
def list_notifications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """List notifications for the current user."""
    notifications = session.exec(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(col(Notification.created_at).desc())
        .limit(50)
    ).all()
    return [
        NotificationResponse(
            id=n.id,
            text=n.text,
            link=n.link,
            is_read=n.is_read,
            created_at=n.created_at
        )
        for n in notifications
    ]

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Mark a notification as read."""
    notification = session.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    notification.is_read = True
    session.add(notification)
    session.commit()
    session.refresh(notification)
    
    return NotificationResponse(
        id=notification.id,
        text=notification.text,
        link=notification.link,
        is_read=notification.is_read,
        created_at=notification.created_at
    )

@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Mark all notifications as read."""
    notifications = session.exec(
        select(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
    ).all()
    
    for n in notifications:
        n.is_read = True
        session.add(n)
        
    session.commit()
    return None
