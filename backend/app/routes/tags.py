
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth.dependencies import get_current_user
from app.core.tags import normalize_tag_key, resolve_canonical_tags, recalculate_tag_usage_counts
from app.database import get_session
from app.models import Tag, TagAlias, User, ReportTag

router = APIRouter(prefix="/api/v1/tags", tags=["Tags"])


class TagResponse(BaseModel):
    id: str
    canonical_name: str
    normalized_key: str
    usage_count: int


class TagAliasCreateRequest(BaseModel):
    alias: str
    canonical_tag: str


def _to_response(tag: Tag) -> TagResponse:
    return TagResponse(
        id=tag.id,
        canonical_name=tag.canonical_name,
        normalized_key=tag.normalized_key,
        usage_count=tag.usage_count,
    )


@router.get("/", response_model=list[TagResponse])
def list_tags(
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    tags = session.exec(
        select(Tag).order_by(Tag.usage_count.desc(), Tag.canonical_name.asc()).limit(limit)
    ).all()
    return [_to_response(tag) for tag in tags]


@router.get("/suggest", response_model=list[TagResponse])
def suggest_tags(
    q: str = Query("", min_length=0),
    limit: int = Query(10, ge=1, le=30),
    session: Session = Depends(get_session),
):
    query = select(Tag)
    if q.strip():
        key = normalize_tag_key(q)
        if not key:
            return []
        query = query.where(Tag.normalized_key.contains(key))

    tags = session.exec(
        query.order_by(Tag.usage_count.desc(), Tag.canonical_name.asc()).limit(limit)
    ).all()
    return [_to_response(tag) for tag in tags]


@router.post("/aliases", response_model=TagResponse)
def create_tag_alias(
    body: TagAliasCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role required.")

    alias_key = normalize_tag_key(body.alias)
    canonical_key = normalize_tag_key(body.canonical_tag)
    if not alias_key or not canonical_key:
        raise HTTPException(status_code=422, detail="Invalid alias or canonical tag.")

    tag = session.exec(select(Tag).where(Tag.normalized_key == canonical_key)).first()
    if not tag:
        resolved = resolve_canonical_tags(session, [canonical_key])
        if not resolved:
            raise HTTPException(status_code=422, detail="Invalid canonical tag.")
        tag = resolved[0]
        session.add(tag)
        session.flush()

    existing = session.exec(select(TagAlias).where(TagAlias.alias_key == alias_key)).first()
    if existing:
        existing.tag_id = tag.id
        session.add(existing)
    else:
        session.add(TagAlias(alias_key=alias_key, tag_id=tag.id))

    recalculate_tag_usage_counts(session)
    session.commit()
    session.refresh(tag)
    return _to_response(tag)


@router.post("/merge", response_model=TagResponse)
def merge_tags(
    source_tag: str = Query(..., description="Tag to merge from"),
    target_tag: str = Query(..., description="Tag to merge into"),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role required.")

    source_key = normalize_tag_key(source_tag)
    target_key = normalize_tag_key(target_tag)
    if not source_key or not target_key or source_key == target_key:
        raise HTTPException(status_code=422, detail="Invalid merge request.")

    source = session.exec(select(Tag).where(Tag.normalized_key == source_key)).first()
    target = session.exec(select(Tag).where(Tag.normalized_key == target_key)).first()
    if not source or not target:
        raise HTTPException(status_code=404, detail="Source or target tag not found.")

    source_links = session.exec(select(ReportTag).where(ReportTag.tag_id == source.id)).all()
    for link in source_links:
        existing_target_link = session.exec(
            select(ReportTag).where(
                ReportTag.report_id == link.report_id,
                ReportTag.tag_id == target.id,
            )
        ).first()
        if existing_target_link:
            session.delete(link)
            continue
        link.tag_id = target.id
        session.add(link)

    existing_alias = session.exec(select(TagAlias).where(TagAlias.alias_key == source_key)).first()
    if existing_alias:
        existing_alias.tag_id = target.id
        session.add(existing_alias)
    else:
        session.add(TagAlias(alias_key=source_key, tag_id=target.id))

    session.delete(source)
    recalculate_tag_usage_counts(session)
    session.commit()
    session.refresh(target)
    return _to_response(target)

@router.delete("/{tag_id}")
def delete_tag(
    tag_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role required.")
        
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found.")
        
    session.delete(tag)
    session.commit()
    return {"status": "Tag deleted"}
