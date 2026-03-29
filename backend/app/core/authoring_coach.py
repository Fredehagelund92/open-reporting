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
            if re.search(
                r"<svg|<rect|<path|<circle|<polygon", code_text, re.IGNORECASE
            ):
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
    kpi_sections: list[dict] | None = None,
    all_sections: list[dict] | None = None,
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
    _SUPERLATIVES = {
        "incredible",
        "amazing",
        "outstanding",
        "impressive",
        "groundbreaking",
    }
    superlative_fields: list[str] = []
    summary_words = set(re.sub(r'["\'].*?["\']', "", summary_trimmed.lower()).split())
    if summary_words & _SUPERLATIVES:
        superlative_fields.append("summary")
    if chart_sections:
        for cs in chart_sections:
            heading = (cs.get("heading") or "").lower()
            heading_clean = re.sub(r'["\'].*?["\']', "", heading)
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
    first_person_pattern = re.compile(r"\b(I |we |our )", re.IGNORECASE)
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
    _number_re = re.compile(r"\d")
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
        styled_ratio = inspector.style_attr_count / max(
            inspector.total_element_count, 1
        )
        if inspector.class_attr_count >= 5 and styled_ratio < 0.25:
            # Severe: report heavily relies on CSS classes — will render broken
            issues.append(
                CoachIssue(
                    rule_id="bare_css_classes",
                    severity="error",
                    message=f"Found {inspector.class_attr_count} elements with CSS classes "
                    f"but only {inspector.style_attr_count} with inline styles. "
                    "CSS classes are stripped — this report will render broken.",
                    suggestion='Replace all CSS class styling with inline style="..." attributes, '
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
                    suggestion='Move all visual styling to inline style="..." attributes.',
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
        from app.core.chart_validation import (
            normalize_chart_values,
            validate_chart_section,
        )

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
                error_msgs = "; ".join(
                    e.message for e in chart_errors if e.severity == "error"
                )
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
    svg_blocks = re.findall(
        r"<svg[^>]*>.*?</svg>", html_body, re.DOTALL | re.IGNORECASE
    )
    for idx, svg_block in enumerate(svg_blocks):
        # Check for empty/fake SVGs — shapes but no data labels
        shape_count = len(
            re.findall(
                r"<(rect|path|circle|polygon|polyline|line)\b", svg_block, re.IGNORECASE
            )
        )
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
        has_px_width = re.search(
            r'width\s*=\s*["\']?\d+(?:px)?["\']?', svg_block.split(">")[0]
        )
        has_percent_width = 'width="100%"' in svg_block or "width='100%'" in svg_block
        if has_px_width and not has_percent_width:
            issues.append(
                CoachIssue(
                    rule_id="chart_fixed_dimensions",
                    severity="warning",
                    message=f"SVG {idx + 1} uses fixed pixel dimensions without width='100%'.",
                    suggestion="Use width='100%' with a viewBox for responsive chart sizing.",
                )
            )

        # Check for many hardcoded hex colors (suggests not using theme)
        hex_colors = set(re.findall(r"#[0-9a-fA-F]{6}", svg_block))
        if len(hex_colors) > 4:
            issues.append(
                CoachIssue(
                    rule_id="chart_hardcoded_colors",
                    severity="info",
                    message=f"SVG {idx + 1} uses {len(hex_colors)} unique hardcoded colors.",
                    suggestion="Consider using the report theme's color palette for visual consistency.",
                )
            )

    # chart_fixed_width: SVG containers in HTML body missing width:100%
    for svg_container_match in re.finditer(
        r"<div[^>]*data-or-chart[^>]*>", html_body, re.IGNORECASE
    ):
        container_tag = svg_container_match.group(0)
        if "width:100%" not in container_tag and "width: 100%" not in container_tag:
            issues.append(
                CoachIssue(
                    rule_id="chart_fixed_width",
                    severity="warning",
                    message="Chart container div is missing width:100% in style attribute.",
                    suggestion="Add style='width:100%; display:block;' to chart container divs.",
                )
            )
            break  # One warning is enough

    # Design rules from structured sections
    if all_sections:
        _flat_sections: list[dict] = []

        def _flatten(secs: list[dict]) -> None:
            for sec in secs:
                _flat_sections.append(sec)
                if sec.get("type") == "columns":
                    for col in sec.get("columns", []):
                        _flatten(col.get("sections", []))
                elif sec.get("type") == "slide":
                    _flatten(sec.get("sections", []))

        _flatten(all_sections)

        # no_summary_header
        if _flat_sections and _flat_sections[0].get("type") != "summary-header":
            issues.append(
                CoachIssue(
                    rule_id="no_summary_header",
                    severity="info",
                    message="Report does not begin with a summary-header section.",
                    suggestion="Add a summary-header as the first section to establish context (title, date, key stats).",
                )
            )

        # action_items rules
        for sec in _flat_sections:
            if sec.get("type") == "action-items":
                for item in sec.get("items", []):
                    if not item.get("owner"):
                        issues.append(
                            CoachIssue(
                                rule_id="action_items_no_owner",
                                severity="warning",
                                message="One or more action items are missing an 'owner' field.",
                                suggestion="Assign every action item an owner (person or team responsible).",
                            )
                        )
                        break
                for item in sec.get("items", []):
                    if not item.get("due"):
                        issues.append(
                            CoachIssue(
                                rule_id="action_items_no_due",
                                severity="warning",
                                message="One or more action items are missing a 'due' field.",
                                suggestion="Add a due date to every action item.",
                            )
                        )
                        break

        # table_single_column
        for sec in _flat_sections:
            if sec.get("type") == "table":
                headers = sec.get("headers", [])
                if len(headers) == 1:
                    issues.append(
                        CoachIssue(
                            rule_id="table_single_column",
                            severity="warning",
                            message="Table has only 1 column — use a bullet list instead.",
                            suggestion="Single-column tables are better expressed as bullet lists in a text section.",
                        )
                    )

        # consecutive_text_sections
        consecutive = 0
        for sec in _flat_sections:
            if sec.get("type") == "text":
                consecutive += 1
                if consecutive >= 3:
                    issues.append(
                        CoachIssue(
                            rule_id="consecutive_text_sections",
                            severity="info",
                            message="3 or more consecutive text sections detected with no visual break.",
                            suggestion="Separate long text runs with a divider, callout, chart, or kpi-grid.",
                        )
                    )
                    break
            else:
                consecutive = 0

        # heading_depth_skip: detect h1->h3 skip in HTML body
        headings_found = [
            int(m) for m in re.findall(r"<h([1-4])\b", html_body, re.IGNORECASE)
        ]
        for i in range(len(headings_found) - 1):
            if headings_found[i + 1] - headings_found[i] > 1:
                issues.append(
                    CoachIssue(
                        rule_id="heading_depth_skip",
                        severity="warning",
                        message=f"Heading level skips from h{headings_found[i]} to h{headings_found[i + 1]}.",
                        suggestion="Use sequential heading levels (h1 → h2 → h3) without skipping.",
                    )
                )
                break

    # Analytics rules — KPI sections
    _TIME_SERIES_PATTERN = re.compile(
        r"^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|q[1-4]|w\d{1,2}|\d{4}-\d{2}|\d{2}/\d{2})",
        re.IGNORECASE,
    )

    if kpi_sections:
        for kpi_sec in kpi_sections:
            for metric in kpi_sec.get("metrics", []):
                value = metric.get("value", "")
                delta = metric.get("delta", "")
                trend = metric.get("trend", "")
                if value and not delta and not trend:
                    issues.append(
                        CoachIssue(
                            rule_id="kpi_missing_delta",
                            severity="warning",
                            message=f"KPI '{metric.get('label', '')}' has a value but no delta or trend.",
                            suggestion="Add a 'delta' (e.g. '+12% YoY') and 'trend' ('up' or 'down') to provide context.",
                        )
                    )
                if delta and not re.search(r"[\d%+\-<>]", str(delta)):
                    issues.append(
                        CoachIssue(
                            rule_id="kpi_delta_is_label",
                            severity="warning",
                            message=f"KPI '{metric.get('label', '')}' delta '{delta}' contains no number, %, or comparison.",
                            suggestion="Delta must include a quantified comparison (e.g. '+3.1 pp', '2nd of 5 regions').",
                        )
                    )
                # Superlative in KPI label
                label_words = set(str(metric.get("label", "")).lower().split())
                if label_words & _SUPERLATIVES:
                    issues.append(
                        CoachIssue(
                            rule_id="superlative_in_structured",
                            severity="warning",
                            message=f"KPI label '{metric.get('label', '')}' contains superlative language.",
                            suggestion="Replace superlatives with specific metrics or factual descriptors.",
                        )
                    )

    # Analytics rules — chart section types
    for cs in chart_sections or []:
        chart_type = cs.get("type", "")
        data = cs.get("data", {})
        labels = data.get("labels", [])
        datasets = data.get("datasets", [])
        segments = data.get("segments", [])

        # chart_no_heading — checked in existing section; covered by chart_heading_missing

        # chart_type_mismatch_time: bar-chart with time-series labels
        if chart_type == "bar-chart" and labels:
            time_like = sum(1 for lbl in labels if _TIME_SERIES_PATTERN.match(str(lbl)))
            if time_like >= len(labels) * 0.6:
                issues.append(
                    CoachIssue(
                        rule_id="chart_type_mismatch_time",
                        severity="warning",
                        message=f"bar-chart used with time-series labels ({', '.join(str(lbl) for lbl in labels[:3])}...). "
                        "Time-series data should use line-chart or area-chart.",
                        suggestion="Change chart type to 'line-chart' or 'area-chart' for time-ordered data.",
                    )
                )

        # chart_type_mismatch_ranking: >5 categories, single dataset, vertical bar-chart
        if chart_type == "bar-chart" and len(labels) > 5 and len(datasets) == 1:
            issues.append(
                CoachIssue(
                    rule_id="chart_type_mismatch_ranking",
                    severity="info",
                    message=f"bar-chart with {len(labels)} categories and a single dataset may be clearer as a horizontal-bar-chart.",
                    suggestion="Use 'horizontal-bar-chart' for ranking/comparison with many categories — labels stay readable.",
                )
            )

        # pie_too_many_segments
        if chart_type in ("pie-chart", "donut-chart") and len(segments) > 6:
            issues.append(
                CoachIssue(
                    rule_id="pie_too_many_segments",
                    severity="warning",
                    message=f"{chart_type} has {len(segments)} segments (max recommended: 6).",
                    suggestion="Consolidate small segments into an 'Other' category, or switch to a horizontal-bar-chart.",
                )
            )

        # chart_heatmap_too_large
        if chart_type == "heatmap-chart":
            x_labels = data.get("x_labels", [])
            y_labels = data.get("y_labels", [])
            if len(x_labels) > 20:
                issues.append(
                    CoachIssue(
                        rule_id="chart_heatmap_too_large",
                        severity="warning",
                        message=f"Heatmap has {len(x_labels)} columns (max recommended: 20). Cells will be very narrow.",
                        suggestion="Reduce columns by aggregating data or splitting into multiple heatmaps.",
                    )
                )
            if len(y_labels) > 15:
                issues.append(
                    CoachIssue(
                        rule_id="chart_heatmap_too_large",
                        severity="warning",
                        message=f"Heatmap has {len(y_labels)} rows (max recommended: 15). Chart will be very tall.",
                        suggestion="Reduce rows by aggregating data or splitting into multiple heatmaps.",
                    )
                )

    # Slide-specific rules (only when content_type == 'slideshow')
    if content_type == "slideshow" and all_sections:
        slide_sections = [s for s in all_sections if s.get("type") == "slide"]
        if not slide_sections:
            slide_sections = [{"type": "slide", "sections": [s]} for s in all_sections]

        thin_slide_count = 0
        total_non_title_slides = 0

        for slide in slide_sections:
            child_sections = slide.get("sections", [])

            # Track title vs non-title slides for composite rules
            is_title_slide = any(
                s.get("type") == "summary-header" for s in child_sections
            )
            if not is_title_slide:
                total_non_title_slides += 1
                if len(child_sections) == 1:
                    thin_slide_count += 1

            # slide_too_dense: >2 sections per slide
            if len(child_sections) > 2:
                issues.append(
                    CoachIssue(
                        rule_id="slide_too_dense",
                        severity="warning",
                        message=f"Slide has {len(child_sections)} sections (max recommended: 2).",
                        suggestion="Move extra sections to separate slides. Each slide should focus on one idea.",
                    )
                )

            # slide_too_thin: single-element slide (not title)
            if len(child_sections) == 1 and not is_title_slide:
                issues.append(
                    CoachIssue(
                        rule_id="slide_too_thin",
                        severity="warning",
                        message="Slide has only 1 section. Combine with a supporting element (callout, text, or chart) for more impact.",
                        suggestion="Add a callout summarizing the key insight, or pair this with a text section for context.",
                    )
                )

            # slide_no_heading: slide without heading or summary-header
            has_heading = any(
                isinstance(c, dict)
                and (c.get("type") == "summary-header" or c.get("heading"))
                for c in child_sections
            )
            if child_sections and not has_heading:
                issues.append(
                    CoachIssue(
                        rule_id="slide_no_heading",
                        severity="warning",
                        message="Slide has no heading or summary-header. Viewers won't know what this slide is about.",
                        suggestion="Add a 'heading' field to the chart or text section, or use a summary-header for the title slide.",
                    )
                )

            for child in child_sections:
                child_type = child.get("type", "")

                # slide_content_overflow: text section >200 chars
                if child_type == "text":
                    overflow_body = str(child.get("body", ""))
                    overflow_plain = re.sub(r"[#*_`\[\]()]", "", overflow_body).strip()
                    if len(overflow_plain) > 200:
                        issues.append(
                            CoachIssue(
                                rule_id="slide_content_overflow",
                                severity="warning",
                                message=f"Slide text section is {len(overflow_plain)} characters (max for overflow prevention: 200). Long text may require scrolling.",
                                suggestion="Shorten to 3-4 bullet points or split the narrative across two slides.",
                            )
                        )

                # slide_content_overflow: table >6 rows
                if child_type == "table":
                    rows = child.get("rows", [])
                    if len(rows) > 6:
                        issues.append(
                            CoachIssue(
                                rule_id="slide_content_overflow",
                                severity="warning",
                                message=f"Slide table has {len(rows)} rows (max recommended: 6). Large tables may require scrolling.",
                                suggestion="Show the top 5-6 rows and add a callout noting the full dataset, or split into two slides.",
                            )
                        )

                # slide_content_overflow: kpi-grid >4 metrics
                if child_type == "kpi-grid":
                    metrics = child.get("metrics", [])
                    if len(metrics) > 4:
                        issues.append(
                            CoachIssue(
                                rule_id="slide_content_overflow",
                                severity="warning",
                                message=f"Slide KPI grid has {len(metrics)} metrics (max recommended: 4). Too many metrics may cause overflow.",
                                suggestion="Keep 3-4 top metrics on this slide and move the rest to a second KPI slide or table.",
                            )
                        )

                # slide_text_heavy: text section >300 chars
                if child_type == "text":
                    body = str(child.get("body", ""))
                    plain = re.sub(r"[#*_`\[\]()]", "", body).strip()
                    if len(plain) > 300:
                        issues.append(
                            CoachIssue(
                                rule_id="slide_text_heavy",
                                severity="warning",
                                message=f"Slide text section is {len(plain)} characters (max recommended: 300).",
                                suggestion="Reduce slide text to bullet points or a single concise paragraph.",
                            )
                        )

                    # slide_bullet_count: bullet list >4 items
                    bullet_count = len(re.findall(r"^\s*[-*+]\s", body, re.MULTILINE))
                    if bullet_count > 4:
                        issues.append(
                            CoachIssue(
                                rule_id="slide_bullet_count",
                                severity="warning",
                                message=f"Slide bullet list has {bullet_count} items (max recommended: 4).",
                                suggestion="Trim the list to 3-4 bullets. Move detail to speaker notes or a separate slide.",
                            )
                        )

            # slide_no_takeaway: chart slide without a callout
            chart_types = {s.get("type") for s in child_sections}
            has_chart = bool(
                chart_types
                & {
                    "bar-chart",
                    "line-chart",
                    "area-chart",
                    "pie-chart",
                    "donut-chart",
                    "horizontal-bar-chart",
                    "stacked-bar-chart",
                    "heatmap-chart",
                }
            )
            has_callout = any(s.get("type") == "callout" for s in child_sections)
            if has_chart and not has_callout:
                issues.append(
                    CoachIssue(
                        rule_id="slide_no_takeaway",
                        severity="info",
                        message="Chart slide has no accompanying callout with the key takeaway.",
                        suggestion="Add a 'callout' section to the slide summarizing what the chart shows.",
                    )
                )

            # slide_tall_combo: 2+ tall elements on one slide
            tall_types = {
                "bar-chart",
                "line-chart",
                "area-chart",
                "pie-chart",
                "donut-chart",
                "horizontal-bar-chart",
                "stacked-bar-chart",
                "heatmap-chart",
            }
            tall_count = 0
            for child in child_sections:
                child_type = child.get("type", "")
                if child_type in tall_types:
                    tall_count += 1
                elif child_type == "kpi-grid" and len(child.get("metrics", [])) >= 3:
                    tall_count += 1
                elif child_type == "table" and len(child.get("rows", [])) >= 4:
                    tall_count += 1
            if tall_count >= 2:
                issues.append(
                    CoachIssue(
                        rule_id="slide_tall_combo",
                        severity="warning",
                        message="Slide combines multiple tall elements (e.g. KPI grid + chart) that will likely overflow the viewport.",
                        suggestion="Split tall elements across separate slides. Pair each with a short element like a callout or text summary.",
                    )
                )

        # slideshow_no_narrative: no text sections anywhere in the slideshow
        has_any_text = any(
            s.get("type") == "text"
            for slide in slide_sections
            for s in slide.get("sections", [])
        )
        if not has_any_text:
            issues.append(
                CoachIssue(
                    rule_id="slideshow_no_narrative",
                    severity="warning",
                    message="Slideshow has no text sections providing narrative context.",
                    suggestion="Add text sections to introduce context, explain insights, or provide recommendations.",
                )
            )

        # slideshow_low_substance: majority of non-title slides are single-element
        if total_non_title_slides > 0 and thin_slide_count / total_non_title_slides > 0.5:
            issues.append(
                CoachIssue(
                    rule_id="slideshow_low_substance",
                    severity="warning",
                    message=f"{thin_slide_count} of {total_non_title_slides} slides contain only a single element. Content this thin may work better as a report or dashboard.",
                    suggestion="Combine related elements onto the same slide, or consider using content_type report instead.",
                )
            )

    score = 100
    for issue in issues:
        if issue.severity == "error":
            score -= 20
        elif issue.severity == "warning":
            score -= 6
        else:
            score -= 2
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
