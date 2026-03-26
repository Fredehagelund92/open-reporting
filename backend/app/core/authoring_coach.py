"""
Authoring coach: deterministic pre-publish quality evaluation.

This module is intentionally rule-based (no model calls) so clients can rely on
stable, machine-readable feedback in retry loops.
"""

import os
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Literal


CoachSeverity = Literal["error", "warning", "info"]

AI_FILLER_PHRASES: list[str] = [
    "it is worth noting",
    "it is important to note",
    "it is important to remember",
    "it should be noted",
    "it goes without saying",
    "needless to say",
    "in conclusion",
    "in summary",
    "to summarize",
    "to conclude",
    "as we can see",
    "as mentioned above",
    "as mentioned earlier",
    "as discussed above",
    "delve into",
    "dive into",
    "unpack",
    "let's explore",
    "let us explore",
    "it's important to note",
    "it's worth noting",
    "i would like to",
    "i am pleased to",
    "we are excited to",
    "we are thrilled to",
    "we are pleased to",
    "rest assured",
    "without further ado",
    "leverage the power",
    "game-changer",
    "game changer",
    "paradigm shift",
    "at the end of the day",
    "cutting-edge",
    "state-of-the-art",
    "in today's fast-paced",
    "in the ever-evolving",
    "shed light on",
    "shed some light",
    "holistic approach",
    "synergy",
    "circle back",
    "move the needle",
]

_META_SUMMARY_STARTS = (
    "this report covers",
    "in this report",
    "the following report",
    "below you will find",
)
CoachStatus = Literal["blocked", "needs_work", "ready"]
CoachMode = Literal["shadow", "enforce"]


@dataclass
class CoachIssue:
    rule_id: str
    severity: CoachSeverity
    message: str
    suggestion: str


@dataclass
class CoachResult:
    readiness_status: CoachStatus
    overall_score: int
    issues: list[CoachIssue]
    suggested_edits: list[str]


class _StructureInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.headings = 0
        self.sections = 0
        self.links = 0
        self.class_attr_count = 0
        self.style_attr_count = 0
        self.total_element_count = 0
        self.paragraph_lengths: list[int] = []
        self._paragraph_buffer: list[str] = []
        self._in_paragraph = False
        # Content element tracking (p, div, section, li)
        self.content_element_count = 0
        self.empty_content_element_count = 0
        self._content_buffer: list[str] = []
        self._in_content_element: str | None = None
        # Code block tracking
        self._in_code_or_pre = False
        self._code_buffer: list[str] = []
        self.code_blocks_with_svg = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_lower = tag.lower()
        self.total_element_count += 1
        attr_map = {k.lower(): (v or "") for k, v in attrs}

        if tag_lower in {"h1", "h2", "h3"}:
            self.headings += 1
        if tag_lower == "section":
            self.sections += 1
        if tag_lower == "a":
            if attr_map.get("href", "").strip():
                self.links += 1
        if tag_lower == "p":
            self._in_paragraph = True
            self._paragraph_buffer = []

        if attr_map.get("class", "").strip():
            self.class_attr_count += 1
        if attr_map.get("style", "").strip():
            self.style_attr_count += 1

        # Track content elements for emptiness check
        if tag_lower in {"p", "li"} and not self._in_content_element:
            self._in_content_element = tag_lower
            self._content_buffer = []
            self.content_element_count += 1

        # Track code/pre blocks
        if tag_lower in {"pre", "code"} and not self._in_code_or_pre:
            self._in_code_or_pre = True
            self._code_buffer = []

    def handle_data(self, data: str) -> None:
        if self._in_paragraph:
            self._paragraph_buffer.append(data)
        if self._in_content_element:
            self._content_buffer.append(data)
        if self._in_code_or_pre:
            self._code_buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if tag_lower == "p" and self._in_paragraph:
            text = "".join(self._paragraph_buffer).strip()
            self.paragraph_lengths.append(len(text))
            self._paragraph_buffer = []
            self._in_paragraph = False

        if tag_lower == self._in_content_element:
            text = "".join(self._content_buffer).strip()
            if not text:
                self.empty_content_element_count += 1
            self._content_buffer = []
            self._in_content_element = None

        if tag_lower in {"pre", "code"} and self._in_code_or_pre:
            code_text = "".join(self._code_buffer)
            if re.search(r"<svg|<rect|<path|<circle|<polygon", code_text, re.IGNORECASE):
                self.code_blocks_with_svg += 1
            self._code_buffer = []
            self._in_code_or_pre = False


def get_authoring_coach_mode() -> CoachMode:
    """
    Rollout toggle:
    - enforce: block publish when readiness_status == blocked (default).
    - shadow: advisory mode, never blocks publish.
    """
    raw = (os.getenv("AUTHORING_COACH_MODE") or "enforce").strip().lower()
    if raw in {"shadow", "advisory", "off"}:
        return "shadow"
    return "enforce"


def evaluate_authoring_quality(
    *,
    title: str,
    summary: str,
    html_body: str,
    content_type: str,
    tags: list[str] | None = None,
    content_format: str = "html",
    chart_sections: list[dict] | None = None,
) -> CoachResult:
    issues: list[CoachIssue] = []
    tags = tags or []

    plain_text = re.sub(r"<[^>]+>", " ", html_body)
    plain_text = re.sub(r"\s+", " ", plain_text).strip()

    inspector = _StructureInspector()
    try:
        inspector.feed(html_body)
    except Exception:
        # HTML parse issues are already handled by the main validator.
        pass

    title_trimmed = title.strip()
    summary_trimmed = summary.strip()

    if len(title_trimmed) < 6:
        issues.append(
            CoachIssue(
                rule_id="title_min_length",
                severity="error",
                message="Title is too short to communicate intent clearly.",
                suggestion="Use a descriptive title with at least 6 characters.",
            )
        )

    if len(plain_text) < 120:
        issues.append(
            CoachIssue(
                rule_id="content_substance",
                severity="error",
                message="Draft content is too short to be a meaningful report.",
                suggestion="Add more substantive body content before publishing.",
            )
        )

    if len(summary_trimmed) < 24:
        issues.append(
            CoachIssue(
                rule_id="summary_quality",
                severity="warning",
                message="Summary is brief and may be unclear in feed previews.",
                suggestion="Write a one-line summary with concrete context and takeaway.",
            )
        )

    # AI filler detection — summary
    summary_lower = summary_trimmed.lower()
    filler_in_summary = [p for p in AI_FILLER_PHRASES if p in summary_lower]
    if filler_in_summary:
        issues.append(
            CoachIssue(
                rule_id="ai_filler_summary",
                severity="error",
                message=f"Summary contains AI filler language: {', '.join(repr(p) for p in filler_in_summary[:3])}.",
                suggestion="Rewrite the summary as a factual one-liner with a specific number or finding. "
                           "Remove filler phrases like 'it is worth noting' and 'in conclusion'.",
            )
        )

    # AI filler detection — body text
    plain_lower = plain_text.lower()
    filler_in_body = [p for p in AI_FILLER_PHRASES if p in plain_lower]
    if len(filler_in_body) >= 3:
        issues.append(
            CoachIssue(
                rule_id="ai_filler_body",
                severity="warning",
                message=f"Body text contains {len(filler_in_body)} AI filler phrases "
                        f"({', '.join(repr(p) for p in filler_in_body[:3])}, ...).",
                suggestion="Remove or replace filler phrases with concrete facts, numbers, or direct statements.",
            )
        )

    # Summary meta-description
    if any(summary_lower.startswith(start) for start in _META_SUMMARY_STARTS):
        issues.append(
            CoachIssue(
                rule_id="summary_is_meta",
                severity="warning",
                message="Summary starts with a meta-description ('This report covers...', 'In this report...', etc.).",
                suggestion="Lead the summary with the key finding or metric, not a description of the report itself.",
            )
        )

    if not tags:
        issues.append(
            CoachIssue(
                rule_id="tag_coverage",
                severity="warning",
                message="No tags provided; discoverability will be lower.",
                suggestion="Add 2-5 relevant tags so others can find this report.",
            )
        )

    if inspector.links == 0:
        issues.append(
            CoachIssue(
                rule_id="evidence_links",
                severity="warning",
                message="No links or citations detected.",
                suggestion="Add source links where claims rely on external facts.",
            )
        )

    # Writing style rules
    _SUPERLATIVES = {"incredible", "amazing", "outstanding", "impressive", "groundbreaking"}
    superlative_fields: list[str] = []
    summary_words = set(re.sub(r'["\'].*?["\']', '', summary_trimmed.lower()).split())
    if summary_words & _SUPERLATIVES:
        superlative_fields.append("summary")
    if chart_sections:
        for cs in chart_sections:
            heading = (cs.get("heading") or "").lower()
            heading_clean = re.sub(r'["\'].*?["\']', '', heading)
            if set(heading_clean.split()) & _SUPERLATIVES:
                superlative_fields.append("chart heading")
                break
    # KPI labels checked below in analytics section; collect from chart_sections
    if superlative_fields:
        issues.append(
            CoachIssue(
                rule_id="superlative_in_structured",
                severity="warning",
                message=f"Superlative language detected in {', '.join(set(superlative_fields))}.",
                suggestion="Replace superlatives with specific numbers or factual comparisons.",
            )
        )

    # First-person voice
    first_person_pattern = re.compile(r'\b(I |we |our )', re.IGNORECASE)
    fp_matches = first_person_pattern.findall(plain_text)
    if len(fp_matches) > 2:
        issues.append(
            CoachIssue(
                rule_id="first_person_voice",
                severity="warning",
                message=f"Body text uses first-person language ({len(fp_matches)} instances of 'I', 'we', or 'our').",
                suggestion="Rewrite in third person: use 'the team', 'revenue', 'the report' instead of 'we' or 'our'.",
            )
        )

    # Paragraph too verbose (>600 chars, <1 number per 200 chars)
    _number_re = re.compile(r'\d')
    for para_len in inspector.paragraph_lengths:
        if para_len > 600:
            # Find the actual paragraph to count numbers
            break  # length check below uses the list

    verbose_paras = []
    for para_len in inspector.paragraph_lengths:
        if para_len > 600:
            # Estimate number density from overall plain text ratio
            # We don't have per-paragraph text here, so we check the ratio globally
            # for paras that are long enough to trigger the rule
            verbose_paras.append(para_len)

    if verbose_paras:
        # Check number density in the whole plain text as a proxy
        num_count = len(_number_re.findall(plain_text))
        density = num_count / max(len(plain_text), 1) * 200  # numbers per 200 chars
        if density < 1:
            issues.append(
                CoachIssue(
                    rule_id="paragraph_too_verbose",
                    severity="warning",
                    message=f"Found {len(verbose_paras)} paragraph(s) over 600 characters with low numeric density.",
                    suggestion="Add specific numbers, percentages, or dates. Every 200 characters should contain at least one number.",
                )
            )

    if inspector.paragraph_lengths and max(inspector.paragraph_lengths) > 800:
        issues.append(
            CoachIssue(
                rule_id="paragraph_density",
                severity="warning",
                message="Very long paragraph detected; readability may suffer.",
                suggestion="Break long paragraphs into smaller sections or bullet points.",
            )
        )

    # Skip bare_css_classes rule for platform-rendered content (markdown/json)
    # since the renderer already applies inline styles.
    if content_format == "html" and inspector.class_attr_count >= 3:
        styled_ratio = inspector.style_attr_count / max(inspector.total_element_count, 1)
        if inspector.class_attr_count >= 5 and styled_ratio < 0.25:
            # Severe: report heavily relies on CSS classes — will render broken
            issues.append(
                CoachIssue(
                    rule_id="bare_css_classes",
                    severity="error",
                    message=f"Found {inspector.class_attr_count} elements with CSS classes "
                            f"but only {inspector.style_attr_count} with inline styles. "
                            "CSS classes are stripped — this report will render broken.",
                    suggestion="Replace all CSS class styling with inline style=\"...\" attributes, "
                               "or use structured_body sections which handle styling automatically.",
                )
            )
        elif inspector.class_attr_count > 2 * max(inspector.style_attr_count, 1):
            issues.append(
                CoachIssue(
                    rule_id="bare_css_classes",
                    severity="warning",
                    message=f"Found {inspector.class_attr_count} elements with CSS classes "
                            f"but only {inspector.style_attr_count} with inline styles. "
                            "CSS classes have no effect — <style> blocks are stripped.",
                    suggestion="Move all visual styling to inline style=\"...\" attributes.",
                )
            )

    # SVGs inside code blocks — LLM tried to show code instead of rendering
    if inspector.code_blocks_with_svg > 0:
        issues.append(
            CoachIssue(
                rule_id="svg_inside_code_block",
                severity="error",
                message=f"Found SVG/HTML markup inside {inspector.code_blocks_with_svg} code block(s). "
                        "Charts should be rendered, not displayed as source code.",
                suggestion="Use structured_body with chart section types (bar-chart, line-chart, "
                           "pie-chart, etc.) — the server renders charts automatically from data.",
            )
        )

    # Empty content elements — indicates garbage LLM output
    if (
        inspector.content_element_count >= 4
        and inspector.empty_content_element_count
        > 0.3 * inspector.content_element_count
    ):
        issues.append(
            CoachIssue(
                rule_id="empty_content_elements",
                severity="warning",
                message=f"{inspector.empty_content_element_count} of {inspector.content_element_count} "
                        "content elements are empty.",
                suggestion="Remove empty paragraphs and list items, or add meaningful content.",
            )
        )

    # Chart-specific validation
    if chart_sections:
        from app.core.chart_validation import normalize_chart_values, validate_chart_section

        for i, chart_sec in enumerate(chart_sections):
            chart_sec = normalize_chart_values(chart_sec)
            chart_errors = validate_chart_section(chart_sec)
            has_chart_error = False
            all_zero_warning = False
            for ce in chart_errors:
                if ce.severity == "error":
                    has_chart_error = True
                if ce.message.startswith("All values are zero"):
                    all_zero_warning = True

            if has_chart_error:
                error_msgs = "; ".join(e.message for e in chart_errors if e.severity == "error")
                issues.append(
                    CoachIssue(
                        rule_id="chart_data_invalid",
                        severity="error",
                        message=f"Chart section {i}: {error_msgs}",
                        suggestion="Fix the chart data errors, then retry.",
                    )
                )

            if all_zero_warning:
                issues.append(
                    CoachIssue(
                        rule_id="chart_all_zero",
                        severity="warning",
                        message=f"Chart section {i}: all values are zero — likely placeholder data.",
                        suggestion="Replace placeholder values with real data.",
                    )
                )

            if not chart_sec.get("heading"):
                issues.append(
                    CoachIssue(
                        rule_id="chart_heading_missing",
                        severity="warning",
                        message=f"Chart section {i} has no heading.",
                        suggestion="Add a descriptive heading to the chart.",
                    )
                )

    # SVG quality checks on the rendered HTML body
    svg_blocks = re.findall(r"<svg[^>]*>.*?</svg>", html_body, re.DOTALL | re.IGNORECASE)
    for idx, svg_block in enumerate(svg_blocks):
        # Check for empty/fake SVGs — shapes but no data labels
        shape_count = len(re.findall(
            r"<(rect|path|circle|polygon|polyline|line)\b", svg_block, re.IGNORECASE
        ))
        text_count = len(re.findall(r"<text\b", svg_block, re.IGNORECASE))
        if shape_count >= 3 and text_count < 2:
            issues.append(
                CoachIssue(
                    rule_id="svg_no_data_labels",
                    severity="error",
                    message=f"SVG {idx + 1} has {shape_count} shapes but only {text_count} text labels — "
                            "appears to be an empty or hand-drawn chart with no real data.",
                    suggestion="Use structured_body chart sections (bar-chart, line-chart, etc.) "
                               "which render labeled charts automatically from data arrays.",
                )
            )

        # Check for missing viewBox
        if "viewBox" not in svg_block and "viewbox" not in svg_block:
            issues.append(
                CoachIssue(
                    rule_id="chart_missing_viewbox",
                    severity="warning",
                    message=f"SVG {idx + 1} is missing a viewBox attribute.",
                    suggestion="Add a viewBox attribute (e.g. viewBox='0 0 760 380') for proper responsive scaling.",
                )
            )

        # Check for small font sizes
        small_fonts = re.findall(r'font-size[=:]\s*["\']?(\d+)', svg_block)
        for fs in small_fonts:
            if int(fs) < 10:
                issues.append(
                    CoachIssue(
                        rule_id="chart_text_too_small",
                        severity="warning",
                        message=f"SVG {idx + 1} has text with font-size {fs}px which may be hard to read.",
                        suggestion="Use font-size 11px or larger for chart text readability.",
                    )
                )
                break  # One warning per SVG is enough

        # Check for fixed px dimensions without width="100%"
        has_px_width = re.search(r'width\s*=\s*["\']?\d+(?:px)?["\']?', svg_block.split(">")[0])
        has_percent_width = 'width="100%"' in svg_block or "width='100%'" in svg_block
        if has_px_width and not has_percent_width:
            issues.append(
                CoachIssue(
                    rule_id="chart_fixed_dimensions",
                    severity="info",
                    message=f"SVG {idx + 1} uses fixed pixel dimensions without width='100%'.",
                    suggestion="Use width='100%' with a viewBox for responsive chart sizing.",
                )
            )

        # Check for many hardcoded hex colors (suggests not using theme)
        hex_colors = set(re.findall(r'#[0-9a-fA-F]{6}', svg_block))
        if len(hex_colors) > 5:
            issues.append(
                CoachIssue(
                    rule_id="chart_hardcoded_colors",
                    severity="info",
                    message=f"SVG {idx + 1} uses {len(hex_colors)} unique hardcoded colors.",
                    suggestion="Consider using the report theme's color palette for visual consistency.",
                )
            )

    score = 100
    for issue in issues:
        if issue.severity == "error":
            score -= 25
        elif issue.severity == "warning":
            score -= 10
        else:
            score -= 4
    score = max(0, min(100, score))

    has_error = any(issue.severity == "error" for issue in issues)
    has_warning = any(issue.severity == "warning" for issue in issues)

    if has_error:
        status: CoachStatus = "blocked"
    elif has_warning:
        status = "needs_work"
    else:
        status = "ready"

    suggested_edits = [issue.suggestion for issue in issues[:5]]

    return CoachResult(
        readiness_status=status,
        overall_score=score,
        issues=issues,
        suggested_edits=suggested_edits,
    )
