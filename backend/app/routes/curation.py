"""
Comments and Upvotes (Human Curation) API routes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, func, col

from app.database import get_session
from app.models import Report, Comment, Upvote, User, Space, SpaceAccess, Mention, Notification
from app.auth.dependencies import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/v1/reports", tags=["Curation & Comments"])


# --- Schemas ---

class CommentCreateRequest(BaseModel):
    text: str


class CommentResponse(BaseModel):
    id: str
    text: str
    author_name: str
    created_at: str


class UpvoteResponse(BaseModel):
    report_id: str
    total_score: int
    user_vote: int


# --- Helpers ---
def _check_report_access(report: Report, current_user: Optional[User], session: Session):
    space = session.get(Space, report.space_id)
    if space.is_private:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        if current_user.role != "ADMIN" and space.owner_id != current_user.id:
            acc = session.exec(select(SpaceAccess).where(SpaceAccess.space_id == space.id, SpaceAccess.user_id == current_user.id)).first()
            if not acc:
                raise HTTPException(status_code=403, detail="Not authorized to access this report")


# --- Comment Routes ---

@router.get("/{report_id}/comments", response_model=list[CommentResponse])
def list_comments(
    report_id: str, 
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """List all comments for a report."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
        
    _check_report_access(report, current_user, session)

    comments = session.exec(
        select(Comment).where(Comment.report_id == report_id).order_by(Comment.created_at)
    ).all()

    results = []
    for c in comments:
        author = session.get(User, c.author_id)
        results.append(CommentResponse(
            id=c.id,
            text=c.text,
            author_name=author.name if author else "Unknown",
            created_at=c.created_at.isoformat(),
        ))
    return results


@router.post("/{report_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    report_id: str,
    body: CommentCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """[Human Action] Post a comment on a report."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
        
    _check_report_access(report, current_user, session)

    comment = Comment(text=body.text, report_id=report_id, author_id=current_user.id)
    session.add(comment)
    session.commit()
    session.refresh(comment)

    # Simple mention parsing: find @name in text
    import re
    mention_names = re.findall(r"@([a-zA-Z0-9_]+)", body.text)
    for name_part in mention_names:
        # Search for users: try exact name without spaces, or start of name
        mentioned_user = session.exec(
            select(User).where(
                (col(User.name).ilike(f"{name_part}%")) | 
                (func.replace(User.name, ' ', '').ilike(f"{name_part}%"))
            )
        ).first()
        if mentioned_user:
            mention = Mention(
                user_id=mentioned_user.id,
                comment_id=comment.id,
                report_id=report_id
            )
            session.add(mention)

            # Also create a Notification
            notification = Notification(
                user_id=mentioned_user.id,
                text=f"{current_user.name} mentioned you in a comment on '{report.title}'",
                link=f"/report/{report.slug}" # Link to the report
            )
            session.add(notification)
    
    if mention_names:
        session.commit()

    return CommentResponse(
        id=comment.id,
        text=comment.text,
        author_name=current_user.name,
        created_at=comment.created_at.isoformat(),
    )


# --- Upvote Routes ---

@router.post("/{report_id}/upvote", response_model=UpvoteResponse)
def toggle_upvote(
    report_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """[Human Action] Toggle an upvote (+1) on a report."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    _check_report_access(report, current_user, session)

    # Check for existing vote by this user
    existing = session.exec(
        select(Upvote).where(Upvote.report_id == report_id, Upvote.user_id == current_user.id)
    ).first()

    if existing:
        if existing.value == 1:
            # Remove the upvote (toggle off)
            session.delete(existing)
        else:
            # Switch from downvote to upvote
            existing.value = 1
            session.add(existing)
    else:
        upvote = Upvote(value=1, report_id=report_id, user_id=current_user.id)
        session.add(upvote)

    session.commit()

    # Calculate total score
    total = session.exec(
        select(func.coalesce(func.sum(Upvote.value), 0)).where(Upvote.report_id == report_id)
    ).one()

    # Get the user's current vote
    user_vote_obj = session.exec(
        select(Upvote).where(Upvote.report_id == report_id, Upvote.user_id == current_user.id)
    ).first()

    return UpvoteResponse(
        report_id=report_id,
        total_score=int(total),
        user_vote=user_vote_obj.value if user_vote_obj else 0,
    )


@router.post("/{report_id}/downvote", response_model=UpvoteResponse)
def toggle_downvote(
    report_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """[Human Action] Toggle a downvote (-1) on a report."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    _check_report_access(report, current_user, session)

    existing = session.exec(
        select(Upvote).where(Upvote.report_id == report_id, Upvote.user_id == current_user.id)
    ).first()

    if existing:
        if existing.value == -1:
            session.delete(existing)
        else:
            existing.value = -1
            session.add(existing)
    else:
        downvote = Upvote(value=-1, report_id=report_id, user_id=current_user.id)
        session.add(downvote)

    session.commit()

    total = session.exec(
        select(func.coalesce(func.sum(Upvote.value), 0)).where(Upvote.report_id == report_id)
    ).one()

    user_vote_obj = session.exec(
        select(Upvote).where(Upvote.report_id == report_id, Upvote.user_id == current_user.id)
    ).first()

    return UpvoteResponse(
        report_id=report_id,
        total_score=int(total),
        user_vote=user_vote_obj.value if user_vote_obj else 0,
    )
