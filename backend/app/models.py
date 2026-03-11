"""
SQLModel database models for Open Reporting.
Defines the core entities: User, Agent, Space, Report, Comment, Upvote.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, Column
import sqlalchemy
import os

if os.getenv("DATABASE_URL", "sqlite:///").startswith("postgres"):
    from pgvector.sqlalchemy import Vector
    VectorType = Vector(1536)
else:
    VectorType = sqlalchemy.JSON

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


# --- Humans ---

class User(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    role: str = Field(default="USER")  # USER, ADMIN
    avatar_url: Optional[str] = None
    provider: str = Field(default="google")  # google, okta, azure_ad, saml
    hashed_password: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)

    comments: List["Comment"] = Relationship(back_populates="author")
    upvotes: List["Upvote"] = Relationship(back_populates="user")
    favorites: List["Favorite"] = Relationship(back_populates="user")
    subscriptions: List["Subscription"] = Relationship(back_populates="user")
    reactions: List["Reaction"] = Relationship(back_populates="user")
    mentions: List["Mention"] = Relationship(back_populates="user")
    spaces: List["Space"] = Relationship(back_populates="owner")
    agents: List["Agent"] = Relationship(back_populates="owner")
    space_accesses: List["SpaceAccess"] = Relationship(back_populates="user")
    notifications: List["Notification"] = Relationship(back_populates="user")


# --- User Favorites ---

class Favorite(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(foreign_key="user.id")
    user: User = Relationship(back_populates="favorites")

    target_type: str  # "space" or "report"
    target_id: str  # ID of the space or report
    label: str  # Display label for quick rendering

    created_at: datetime = Field(default_factory=_utcnow)


# --- User Subscriptions ---

class Subscription(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    user: User = Relationship(back_populates="subscriptions")

    target_type: str  # "space" or "agent"
    target_id: str
    label: str = Field(default="")

    created_at: datetime = Field(default_factory=_utcnow)


# --- Machine Clients (Agents) ---

class Agent(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str = Field(unique=True, index=True)
    description: Optional[str] = None
    status: str = Field(default="IDLE")  # IDLE, GENERATING, OFFLINE
    api_key: str = Field(unique=True, index=True)
    claim_url_token: Optional[str] = Field(default=None, unique=True)
    is_claimed: bool = Field(default=False)
    
    owner_id: Optional[str] = Field(default=None, foreign_key="user.id")
    owner: Optional[User] = Relationship(back_populates="agents")
    is_private: bool = Field(default=False)
    
    created_at: datetime = Field(default_factory=_utcnow)

    reports: List["Report"] = Relationship(back_populates="agent")


# --- Topics / Sub-forums ---

class SpaceAccess(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    user: "User" = Relationship(back_populates="space_accesses")
    space_id: str = Field(foreign_key="space.id", index=True)
    space: "Space" = Relationship(back_populates="accesses")
    created_at: datetime = Field(default_factory=_utcnow)


class Space(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    name: str = Field(unique=True, index=True)  # e.g. "o/marketing"
    description: Optional[str] = None
    is_private: bool = Field(default=False)
    
    owner_id: Optional[str] = Field(default=None, foreign_key="user.id")
    owner: Optional[User] = Relationship(back_populates="spaces")
    
    created_at: datetime = Field(default_factory=_utcnow)

    reports: List["Report"] = Relationship(back_populates="space")
    accesses: List["SpaceAccess"] = Relationship(back_populates="space")


# --- Static HTML Reports ---

class Report(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    title: str
    summary: str
    tags: str = Field(default="[]")  # JSON string array
    slug: str = Field(unique=True, index=True)
    html_body: str  # The actual HTML content payload
    content_type: str = Field(default="report")  # "report" or "slideshow"
    
    embedding: Optional[List[float]] = Field(default=None, sa_column=Column(VectorType))

    agent_id: str = Field(foreign_key="agent.id")
    agent: Agent = Relationship(back_populates="reports")

    space_id: str = Field(foreign_key="space.id")
    space: Space = Relationship(back_populates="reports")

    created_at: datetime = Field(default_factory=_utcnow)

    comments: List["Comment"] = Relationship(back_populates="report")
    upvotes: List["Upvote"] = Relationship(back_populates="report")
    reactions: List["Reaction"] = Relationship(back_populates="report")
    mentions: List["Mention"] = Relationship(back_populates="report")


# --- Human Discussions ---

class Comment(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    text: str

    report_id: str = Field(foreign_key="report.id")
    report: Report = Relationship(back_populates="comments")

    author_id: str = Field(foreign_key="user.id")
    author: User = Relationship(back_populates="comments")

    created_at: datetime = Field(default_factory=_utcnow)

    reactions: List["Reaction"] = Relationship(back_populates="comment")
    mentions: List["Mention"] = Relationship(back_populates="comment")


# --- Human Curation ---

class Upvote(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    value: int = Field(default=1)  # 1 for upvote, -1 for downvote

    report_id: str = Field(foreign_key="report.id")
    report: Report = Relationship(back_populates="upvotes")

    user_id: str = Field(foreign_key="user.id")
    user: User = Relationship(back_populates="upvotes")

    created_at: datetime = Field(default_factory=_utcnow)


# --- Social Interactions ---

class Reaction(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    emoji: str  # The emoji character or alias (e.g., "👍" or "heart")

    user_id: str = Field(foreign_key="user.id", index=True)
    user: User = Relationship(back_populates="reactions")

    report_id: Optional[str] = Field(default=None, foreign_key="report.id", index=True)
    report: Optional[Report] = Relationship(back_populates="reactions")

    comment_id: Optional[str] = Field(default=None, foreign_key="comment.id", index=True)
    comment: Optional[Comment] = Relationship(back_populates="reactions")

    created_at: datetime = Field(default_factory=_utcnow)


class Mention(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)

    user_id: str = Field(foreign_key="user.id", index=True)
    user: User = Relationship(back_populates="mentions")

    report_id: Optional[str] = Field(default=None, foreign_key="report.id", index=True)
    report: Optional[Report] = Relationship(back_populates="mentions")

    comment_id: Optional[str] = Field(default=None, foreign_key="comment.id", index=True)
    comment: Optional[Comment] = Relationship(back_populates="mentions")

    created_at: datetime = Field(default_factory=_utcnow)


class Notification(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    user: User = Relationship(back_populates="notifications")

    text: str
    link: str  # URL to navigate to
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_utcnow)
