"""
LLM-based report quality review module.

Uses Claude Haiku to evaluate reports across writing, analytics, and design
dimensions. Designed to run after the rule-based authoring coach passes.
"""

import hashlib
import json
import os
import time
from dataclasses import dataclass, field


@dataclass
class DimensionScore:
    score: float  # 1.0 - 5.0
    issues: list[str] = field(default_factory=list)
    fix_instructions: list[str] = field(default_factory=list)


@dataclass
class ReviewResult:
    status: str  # "passed", "blocked", "skipped"
    scores: dict[str, DimensionScore] = field(default_factory=dict)
    issues: list[str] = field(default_factory=list)
    fix_instructions: list[str] = field(default_factory=list)
    average_score: float = 0.0


# Simple in-process cache: {content_hash: (timestamp, ReviewResult)}
_review_cache: dict[str, tuple[float, ReviewResult]] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


def _cache_key(html_body: str, meta: dict) -> str:
    payload = json.dumps({"html": html_body, **meta}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


def _cached_result(key: str) -> ReviewResult | None:
    entry = _review_cache.get(key)
    if entry is None:
        return None
    ts, result = entry
    if time.time() - ts > _CACHE_TTL_SECONDS:
        del _review_cache[key]
        return None
    return result


def _store_result(key: str, result: ReviewResult) -> None:
    _review_cache[key] = (time.time(), result)


def get_llm_review_mode() -> str:
    """Return 'enforce' or 'shadow'. Defaults to 'shadow'."""
    raw = (os.getenv("LLM_REVIEW_MODE") or "shadow").strip().lower()
    return "enforce" if raw == "enforce" else "shadow"


def _build_prompt(
    html_body: str,
    title: str,
    summary: str,
    tags: list[str],
    theme: str,
    content_type: str,
    coach_issues: list[str],
) -> str:
    is_slideshow = content_type == "slideshow"
    slide_note = (
        "\n\nThis is a SLIDESHOW. Apply stricter brevity standards: each slide must be "
        "scannable in 10 seconds, text must be minimal, and every chart slide needs a key takeaway."
        if is_slideshow
        else ""
    )
    coach_summary = (
        "\n\nCoach pre-check issues (already flagged, for context only):\n"
        + "\n".join(f"- {i}" for i in coach_issues[:5])
        if coach_issues
        else ""
    )

    return f"""You are an expert report quality reviewer. Evaluate the following report across three dimensions and return a JSON object.

## Report Metadata
- Title: {title}
- Summary: {summary}
- Tags: {", ".join(tags) if tags else "none"}
- Theme: {theme}
- Content type: {content_type}
{slide_note}{coach_summary}

## Report HTML Body
{html_body[:8000]}

## Rubric

Score each dimension 1-5 (integers or .5 increments):

### Writing (1-5)
- 5: Every sentence is factual, specific, and numbered. No filler. Third-person. Headlines lead with the finding.
- 4: Mostly factual and specific. Minor filler or first-person usage.
- 3: Some filler phrases or vague claims. Acceptable but could be tightened.
- 2: Significant AI filler, superlatives, or unsupported claims.
- 1: Heavy filler language, first-person throughout, or near-zero data content.

### Analytics (1-5)
- 5: Every chart type matches its data shape. Every KPI has delta+trend. Data is complete and consistent.
- 4: Charts mostly appropriate. Minor KPI context missing.
- 3: One chart type mismatch or several KPIs without context.
- 2: Multiple chart mismatches or KPIs are labels without numbers.
- 1: Charts don't match data, all-zero values, or no analytics content.

### Design (1-5)
- 5: Logical section order, appropriate layout, charts fill width, action items have owners and due dates.
- 4: Good structure with minor issues (missing summary-header, one unowned action item).
- 3: Structure is functional but could be improved (consecutive text sections, missing callouts).
- 2: Poor structure (no KPIs, no visual breaks, tables without captions).
- 1: No structure, wall of text, or broken layout.

## Required Output Format

Return ONLY valid JSON, no other text:

{{
  "writing": {{
    "score": <float 1-5>,
    "issues": ["<specific issue>"],
    "fix_instructions": ["<actionable fix>"]
  }},
  "analytics": {{
    "score": <float 1-5>,
    "issues": ["<specific issue>"],
    "fix_instructions": ["<actionable fix>"]
  }},
  "design": {{
    "score": <float 1-5>,
    "issues": ["<specific issue>"],
    "fix_instructions": ["<actionable fix>"]
  }}
}}"""


def _parse_response(response_text: str) -> dict:
    """Parse the LLM JSON response, stripping markdown fences if present."""
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(text)


def _skipped_result() -> ReviewResult:
    return ReviewResult(status="skipped")


def _determine_status(
    scores: dict[str, DimensionScore],
    min_score: float,
    min_avg: float,
) -> str:
    if not scores:
        return "skipped"
    avg = sum(d.score for d in scores.values()) / len(scores)
    if any(d.score < min_score for d in scores.values()) or avg < min_avg:
        return "blocked"
    return "passed"


def review_report(
    *,
    html_body: str,
    title: str,
    summary: str,
    tags: list[str],
    theme: str,
    content_type: str,
    coach_issues: list[str] | None = None,
) -> ReviewResult:
    """
    Run LLM quality review on a report.

    Returns a ReviewResult with status 'passed', 'blocked', or 'skipped'.
    Always returns 'skipped' on timeout or API error — never blocks on infra failures.
    """
    enabled = os.getenv("LLM_REVIEW_ENABLED", "true").strip().lower()
    if enabled in ("false", "0", "no", "off"):
        return _skipped_result()

    timeout_ms = int(os.getenv("LLM_REVIEW_TIMEOUT_MS", "15000"))
    min_score = float(os.getenv("LLM_REVIEW_MIN_SCORE", "3"))
    min_avg = float(os.getenv("LLM_REVIEW_MIN_AVG", "3.5"))
    model = os.getenv("LLM_REVIEW_MODEL", "claude-haiku-4-5-20251001")

    meta = {
        "title": title,
        "summary": summary,
        "tags": sorted(tags),
        "theme": theme,
        "content_type": content_type,
    }
    cache_key = _cache_key(html_body, meta)
    cached = _cached_result(cache_key)
    if cached is not None and cached.status == "passed":
        return cached

    coach_issues = coach_issues or []
    prompt = _build_prompt(
        html_body, title, summary, tags, theme, content_type, coach_issues
    )

    try:
        import anthropic

        client = anthropic.Anthropic()
        timeout_sec = timeout_ms / 1000.0

        message = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
            timeout=timeout_sec,
        )

        from anthropic.types import TextBlock

        first_block = message.content[0]
        if not isinstance(first_block, TextBlock):
            return _skipped_result()
        response_text = first_block.text
        parsed = _parse_response(response_text)

        scores: dict[str, DimensionScore] = {}
        all_issues: list[str] = []
        all_fixes: list[str] = []

        for dim in ("writing", "analytics", "design"):
            dim_data = parsed.get(dim, {})
            dim_score = float(dim_data.get("score", 3.0))
            dim_issues = [str(i) for i in dim_data.get("issues", [])]
            dim_fixes = [str(f) for f in dim_data.get("fix_instructions", [])]
            scores[dim] = DimensionScore(
                score=dim_score,
                issues=dim_issues,
                fix_instructions=dim_fixes,
            )
            all_issues.extend(dim_issues)
            all_fixes.extend(dim_fixes)

        avg = sum(d.score for d in scores.values()) / len(scores)
        status = _determine_status(scores, min_score, min_avg)

        result = ReviewResult(
            status=status,
            scores=scores,
            issues=all_issues,
            fix_instructions=all_fixes,
            average_score=round(avg, 2),
        )
        _store_result(cache_key, result)
        return result

    except Exception:
        # Never block publish on infra failures
        return _skipped_result()
