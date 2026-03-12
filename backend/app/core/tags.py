import re
from typing import Iterable

from sqlmodel import Session, select

from app.models import Report, Tag, TagAlias, ReportTag

MAX_TAGS_PER_REPORT = 8
MAX_TAG_LENGTH = 32
MIN_TAG_LENGTH = 2


def normalize_tag_key(raw: str) -> str:
    value = (raw or "").strip().lower()
    value = re.sub(r"[\s_]+", "-", value)
    value = re.sub(r"[^a-z0-9-]", "", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    if len(value) < MIN_TAG_LENGTH or len(value) > MAX_TAG_LENGTH:
        return ""
    return value


def _get_alias_map(session: Session, normalized_keys: Iterable[str]) -> dict[str, str]:
    keys = [k for k in set(normalized_keys) if k]
    if not keys:
        return {}
    rows = session.exec(select(TagAlias).where(TagAlias.alias_key.in_(keys))).all()
    return {row.alias_key: row.tag_id for row in rows}


def _get_or_create_tag_by_key(session: Session, normalized_key: str) -> Tag:
    existing = session.exec(select(Tag).where(Tag.normalized_key == normalized_key)).first()
    if existing:
        return existing
    tag = Tag(canonical_name=normalized_key, normalized_key=normalized_key)
    session.add(tag)
    session.flush()
    return tag


def resolve_canonical_tags(session: Session, raw_tags: list[str]) -> list[Tag]:
    normalized = []
    for tag in raw_tags[:MAX_TAGS_PER_REPORT]:
        key = normalize_tag_key(tag)
        if key and key not in normalized:
            normalized.append(key)

    if not normalized:
        return []

    alias_map = _get_alias_map(session, normalized)
    resolved_tags: list[Tag] = []
    seen_tag_ids: set[str] = set()

    for key in normalized:
        if key in alias_map:
            tag = session.get(Tag, alias_map[key])
            if not tag:
                continue
        else:
            tag = _get_or_create_tag_by_key(session, key)

        if tag.id in seen_tag_ids:
            continue

        seen_tag_ids.add(tag.id)
        resolved_tags.append(tag)

    return resolved_tags


def attach_tags_to_report(session: Session, report: Report, tags: list[Tag]) -> None:
    # Remove stale links first for deterministic output.
    existing_links = session.exec(
        select(ReportTag).where(ReportTag.report_id == report.id)
    ).all()
    for link in existing_links:
        session.delete(link)

    for tag in tags:
        session.add(ReportTag(report_id=report.id, tag_id=tag.id))

    session.add(report)
    session.flush()


def recalculate_tag_usage_counts(session: Session) -> None:
    all_tags = session.exec(select(Tag)).all()
    for tag in all_tags:
        count = len(
            session.exec(select(ReportTag).where(ReportTag.tag_id == tag.id)).all()
        )
        tag.usage_count = count
        session.add(tag)
    session.flush()


