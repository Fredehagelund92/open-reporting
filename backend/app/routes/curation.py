"""
Comments and Upvotes (Human Curation) API routes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select, func, col

from app.database import get_session
from app.models import (
    Report,
    Comment,
    Upvote,
    User,
    Space,
    SpaceAccess,
    Mention,
    Notification,
    Reaction,
)
from app.auth.dependencies import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/v1/reports", tags=["Curation & Comments"])


# --- Schemas ---


class CommentCreateRequest(BaseModel):
    text: str
    quoted_text: Optional[str] = Field(None, max_length=500)


class CommentReactionSummary(BaseModel):
    emoji: str
    count: int
    reacted: bool = False


class CommentResponse(BaseModel):
    id: str
    text: str
    quoted_text: Optional[str] = None
    author_name: str
    author_avatar: Optional[str] = None
    created_at: str
    reactions: list[CommentReactionSummary] = []


class ReactionToggleRequest(BaseModel):
    emoji: str


class ReactionToggleResponse(BaseModel):
    comment_id: str
    emoji: str
    reacted: bool
    total_count: int


class UpvoteResponse(BaseModel):
    report_id: str
    total_score: int
    user_vote: int


# --- Helpers ---
def _check_report_access(
    report: Report, current_user: Optional[User], session: Session
):
    space = session.get(Space, report.space_id)
    if space.is_private:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        if current_user.role != "ADMIN" and space.owner_id != current_user.id:
            acc = session.exec(
                select(SpaceAccess).where(
                    SpaceAccess.space_id == space.id,
                    SpaceAccess.user_id == current_user.id,
                )
            ).first()
            if not acc:
                raise HTTPException(
                    status_code=403, detail="Not authorized to access this report"
                )


# --- Comment Routes ---


@router.get("/{report_id}/comments", response_model=list[CommentResponse])
def list_comments(
    report_id: str,
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List all comments for a report."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    _check_report_access(report, current_user, session)

    comments = session.exec(
        select(Comment)
        .where(Comment.report_id == report_id)
        .order_by(Comment.created_at)
    ).all()

    comment_ids = [comment.id for comment in comments]
    reaction_counts: dict[str, dict[str, int]] = {}
    user_reactions: set[tuple[str, str]] = set()
    if comment_ids:
        reaction_rows = session.exec(
            select(Reaction.comment_id, Reaction.emoji, func.count(Reaction.id))
            .where(col(Reaction.comment_id).in_(comment_ids))
            .group_by(Reaction.comment_id, Reaction.emoji)
        ).all()
        for comment_id, emoji, total in reaction_rows:
            if not comment_id:
                continue
            reaction_counts.setdefault(comment_id, {})[emoji] = int(total)

        if current_user:
            reacted_rows = session.exec(
                select(Reaction.comment_id, Reaction.emoji).where(
                    Reaction.user_id == current_user.id,
                    col(Reaction.comment_id).in_(comment_ids),
                )
            ).all()
            user_reactions = {
                (comment_id, emoji) for comment_id, emoji in reacted_rows if comment_id
            }

    results = []
    for c in comments:
        author = session.get(User, c.author_id)
        per_comment_counts = reaction_counts.get(c.id, {})
        reaction_items = [
            CommentReactionSummary(
                emoji=emoji,
                count=count,
                reacted=(c.id, emoji) in user_reactions,
            )
            for emoji, count in sorted(
                per_comment_counts.items(), key=lambda item: (-item[1], item[0])
            )
        ]
        results.append(
            CommentResponse(
                id=c.id,
                text=c.text,
                quoted_text=c.quoted_text,
                author_name=author.name if author else "Unknown",
                author_avatar=author.avatar_url if author else None,
                created_at=c.created_at.isoformat(),
                reactions=reaction_items,
            )
        )
    return results


@router.post(
    "/{report_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    report_id: str,
    body: CommentCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """[Human Action] Post a comment on a report."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    _check_report_access(report, current_user, session)

    comment = Comment(
        text=body.text,
        quoted_text=body.quoted_text,
        report_id=report_id,
        author_id=current_user.id,
    )
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
                (col(User.name).ilike(f"{name_part}%"))
                | (func.replace(User.name, " ", "").ilike(f"{name_part}%"))
            )
        ).first()
        if mentioned_user:
            mention = Mention(
                user_id=mentioned_user.id, comment_id=comment.id, report_id=report_id
            )
            session.add(mention)

            # Also create a Notification
            notification = Notification(
                user_id=mentioned_user.id,
                text=f"{current_user.name} mentioned you in a comment on '{report.title}'",
                link=f"/report/{report.slug}",  # Link to the report
            )
            session.add(notification)

    if mention_names:
        session.commit()

    return CommentResponse(
        id=comment.id,
        text=comment.text,
        quoted_text=comment.quoted_text,
        author_name=current_user.name,
        author_avatar=current_user.avatar_url,
        created_at=comment.created_at.isoformat(),
        reactions=[],
    )


@router.post(
    "/{report_id}/comments/{comment_id}/reactions",
    response_model=ReactionToggleResponse,
)
def toggle_comment_reaction(
    report_id: str,
    comment_id: str,
    body: ReactionToggleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Toggle an emoji reaction on a comment."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    _check_report_access(report, current_user, session)

    comment = session.get(Comment, comment_id)
    if not comment or comment.report_id != report_id:
        raise HTTPException(status_code=404, detail="Comment not found.")

    emoji = body.emoji.strip()
    if not emoji or len(emoji) > 16:
        raise HTTPException(
            status_code=422, detail="Emoji must be between 1 and 16 characters."
        )

    existing = session.exec(
        select(Reaction).where(
            Reaction.comment_id == comment_id,
            Reaction.user_id == current_user.id,
            Reaction.emoji == emoji,
        )
    ).first()

    reacted = False
    if existing:
        session.delete(existing)
    else:
        session.add(
            Reaction(
                emoji=emoji,
                user_id=current_user.id,
                comment_id=comment_id,
                report_id=report_id,
            )
        )
        reacted = True

    session.commit()

    total = session.exec(
        select(func.count(Reaction.id)).where(
            Reaction.comment_id == comment_id,
            Reaction.emoji == emoji,
        )
    ).one()

    return ReactionToggleResponse(
        comment_id=comment_id,
        emoji=emoji,
        reacted=reacted,
        total_count=int(total),
    )


# --- Upvote Routes ---


@router.post("/{report_id}/upvote", response_model=UpvoteResponse)
def toggle_upvote(
    report_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """[Human Action] Toggle an upvote (+1) on a report."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    _check_report_access(report, current_user, session)

    # Check for existing vote by this user
    existing = session.exec(
        select(Upvote).where(
            Upvote.report_id == report_id, Upvote.user_id == current_user.id
        )
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
        select(func.coalesce(func.sum(Upvote.value), 0)).where(
            Upvote.report_id == report_id
        )
    ).one()

    # Get the user's current vote
    user_vote_obj = session.exec(
        select(Upvote).where(
            Upvote.report_id == report_id, Upvote.user_id == current_user.id
        )
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
    current_user: User = Depends(get_current_user),
):
    """[Human Action] Toggle a downvote (-1) on a report."""
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    _check_report_access(report, current_user, session)

    existing = session.exec(
        select(Upvote).where(
            Upvote.report_id == report_id, Upvote.user_id == current_user.id
        )
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
        select(func.coalesce(func.sum(Upvote.value), 0)).where(
            Upvote.report_id == report_id
        )
    ).one()

    user_vote_obj = session.exec(
        select(Upvote).where(
            Upvote.report_id == report_id, Upvote.user_id == current_user.id
        )
    ).first()

    return UpvoteResponse(
        report_id=report_id,
        total_score=int(total),
        user_vote=user_vote_obj.value if user_vote_obj else 0,
    )
