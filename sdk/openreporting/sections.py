"""Thin dict factory helpers for building structured report sections.

Each function returns a plain dict suitable for inclusion in the
``sections`` list passed to :pymeth:`OpenReportingClient.publish`.
"""

from __future__ import annotations


def text(heading: str, body: str) -> dict:
    """A text section with a heading and body content."""
    return {"type": "text", "heading": heading, "body": body}


def kpi_grid(metrics: list[dict]) -> dict:
    """A grid of key-performance-indicator cards.

    Each metric dict should contain at minimum ``label`` and ``value`` keys.
    """
    return {"type": "kpi-grid", "metrics": metrics}


def table(headers: list[str], rows: list[list[str | int | float]]) -> dict:
    """A data table section."""
    return {"type": "table", "headers": headers, "rows": rows}


def callout(message: str, type: str = "info") -> dict:
    """A highlighted callout block.

    ``type`` can be ``"info"``, ``"warning"``, ``"success"``, or ``"error"``.
    """
    return {"type": "callout", "message": message, "callout_type": type}


def bar_chart(
    labels: list[str],
    datasets: list[dict] | None = None,
    *,
    values: list[float] | None = None,
    heading: str = "",
) -> dict:
    """A bar chart section.

    Preferred: pass ``datasets`` as a list of ``{"name": str, "values": [...]}``.
    Legacy: pass ``values`` directly (single series named "Value").

    Server validates: each dataset's ``values`` length must match ``labels``
    length, all values must be plain numbers (no strings), and ``heading``
    is recommended.
    """
    if datasets is None:
        datasets = [{"name": "Value", "values": values or []}]
    section: dict = {
        "type": "bar-chart",
        "data": {"labels": labels, "datasets": datasets},
    }
    if heading:
        section["heading"] = heading
    return section


def line_chart(
    labels: list[str],
    datasets: list[dict],
    *,
    heading: str = "",
) -> dict:
    """A line chart section.

    ``datasets``: list of ``{"name": str, "values": [...]}``.

    Server validates: each dataset's ``values`` length must match ``labels``
    length. ``heading`` is recommended.
    """
    section: dict = {
        "type": "line-chart",
        "data": {"labels": labels, "datasets": datasets},
    }
    if heading:
        section["heading"] = heading
    return section


def area_chart(
    labels: list[str],
    datasets: list[dict],
    *,
    heading: str = "",
) -> dict:
    """An area chart section (filled line chart).

    ``datasets``: list of ``{"name": str, "values": [...]}``.

    Server validates: each dataset's ``values`` length must match ``labels``
    length. ``heading`` is recommended.
    """
    section: dict = {
        "type": "area-chart",
        "data": {"labels": labels, "datasets": datasets},
    }
    if heading:
        section["heading"] = heading
    return section


def pie_chart(
    segments: list[dict],
    *,
    heading: str = "",
) -> dict:
    """A pie chart section.

    ``segments``: list of ``{"label": str, "value": float}``.

    Server validates: all values must be positive numbers, sum must be > 0.
    ``heading`` is recommended.
    """
    section: dict = {
        "type": "pie-chart",
        "data": {"segments": segments},
    }
    if heading:
        section["heading"] = heading
    return section


def timeline(events: list[dict]) -> dict:
    """A chronological timeline of events.

    Each event dict should contain ``date`` and ``description`` keys.
    """
    return {"type": "timeline", "events": events}


def action_items(items: list[dict]) -> dict:
    """A list of action items / to-dos.

    Each item dict should contain at minimum a ``text`` key.
    """
    return {"type": "action-items", "items": items}


def slide(sections: list[dict], *, background_color: str = "#ffffff") -> dict:
    """A presentation slide grouping one or more sections onto a single slide.

    Use this when ``content_type="slideshow"`` to control which sections appear
    together on each slide and to set per-slide background colours.

    ``sections``: list of section dicts to render on this slide.
    ``background_color``: hex colour for the slide background (e.g. ``"#0f172a"``
    for a dark title slide).
    """
    return {
        "type": "slide",
        "background_color": background_color,
        "sections": sections,
    }


def columns(cols: list[list[dict]]) -> dict:
    """A multi-column layout wrapping child sections side by side.

    ``cols``: list of columns, where each column is a list of section dicts.
    """
    return {
        "type": "columns",
        "columns": [{"sections": col} for col in cols],
    }


def summary_header(
    title: str,
    *,
    subtitle: str = "",
    date: str = "",
    stats: list[dict] | None = None,
) -> dict:
    """A styled report header with title, subtitle, date, and key stats.

    ``stats``: list of ``{"label": str, "value": str}`` dicts.
    """
    section: dict = {"type": "summary-header", "title": title}
    if subtitle:
        section["subtitle"] = subtitle
    if date:
        section["date"] = date
    if stats:
        section["stats"] = stats
    return section


def divider(label: str = "") -> dict:
    """A horizontal divider with an optional centered label."""
    section: dict = {"type": "divider"}
    if label:
        section["label"] = label
    return section


def spacer(height: str = "40px") -> dict:
    """Vertical whitespace. Height accepts px or rem values."""
    return {"type": "spacer", "height": height}


def horizontal_bar_chart(
    labels: list[str],
    datasets: list[dict] | None = None,
    *,
    values: list[float] | None = None,
    heading: str = "",
) -> dict:
    """A horizontal bar chart (bars extend right, labels on Y-axis).

    Same data shape as ``bar_chart``.
    """
    if datasets is None:
        datasets = [{"name": "Value", "values": values or []}]
    section: dict = {
        "type": "horizontal-bar-chart",
        "data": {"labels": labels, "datasets": datasets},
    }
    if heading:
        section["heading"] = heading
    return section


def stacked_bar_chart(
    labels: list[str],
    datasets: list[dict],
    *,
    heading: str = "",
) -> dict:
    """A stacked bar chart (datasets stacked vertically per label).

    Same data shape as ``bar_chart`` with multiple datasets.
    """
    section: dict = {
        "type": "stacked-bar-chart",
        "data": {"labels": labels, "datasets": datasets},
    }
    if heading:
        section["heading"] = heading
    return section


def donut_chart(
    segments: list[dict],
    *,
    heading: str = "",
    center_label: str = "",
) -> dict:
    """A donut chart (pie chart with center cutout).

    ``segments``: list of ``{"label": str, "value": float}``.
    ``center_label``: optional text displayed in the center of the donut.
    """
    section: dict = {
        "type": "donut-chart",
        "data": {"segments": segments},
    }
    if center_label:
        section["data"]["center_label"] = center_label
    if heading:
        section["heading"] = heading
    return section


def sparkline(values: list[float], *, heading: str = "") -> dict:
    """A tiny inline sparkline chart (no axes, no labels).

    ``values``: list of numbers to plot.
    """
    section: dict = {
        "type": "sparkline",
        "data": {"values": values},
    }
    if heading:
        section["heading"] = heading
    return section


def sections_reference() -> str:
    """Return a compact catalog of all section types and their JSON shapes.

    This is a pure component reference — no response format, no design
    opinions. Embed it in LLM prompts alongside your own instructions.
    """
    return '''\
OPEN REPORTING — SECTION TYPES

Content:
- text: {"type": "text", "heading": "...", "body": "Markdown text..."}
- kpi-grid: {"type": "kpi-grid", "metrics": [{"label": "...", "value": "...", "delta": "+5%", "trend": "up"}]}
- table: {"type": "table", "headers": ["Col1", "Col2"], "rows": [["a", "b"], ["c", "d"]]}
- callout: {"type": "callout", "message": "...", "callout_type": "info|warning|success|error"}
- timeline: {"type": "timeline", "events": [{"date": "...", "description": "..."}]}
- action-items: {"type": "action-items", "items": [{"text": "...", "owner": "...", "due": "..."}]}

Charts:
- bar-chart: {"type": "bar-chart", "heading": "...", "data": {"labels": ["A","B"], "datasets": [{"name": "Series", "values": [10, 20]}]}}
- horizontal-bar-chart: same shape as bar-chart (bars extend right)
- stacked-bar-chart: same shape as bar-chart (multiple datasets stacked)
- line-chart: same shape as bar-chart
- area-chart: same shape as bar-chart (filled line chart)
- pie-chart: {"type": "pie-chart", "heading": "...", "data": {"segments": [{"label": "A", "value": 42}]}}
- donut-chart: same as pie-chart, optional "center_label" in data
- sparkline: {"type": "sparkline", "heading": "...", "data": {"values": [1, 3, 2, 5]}}
  Sparklines are tiny inline trend indicators — only for use inside KPI cards, not standalone.

Presentation:
- slide: {"type": "slide", "background_color": "#ffffff", "sections": [...child sections...]}
  Use with content_type="slideshow". Each slide groups sections onto a single navigable slide.
  Use dark backgrounds (e.g. "#0f172a") for title slides.
  Slide density: 1 section per slide (2 max for small items like kpi-grid + callout).
  Charts, tables, and timelines always get their own slide.
  Every chart slide must include a callout or short text with the key takeaway.
  Use "columns" to place two text blocks side-by-side instead of stacking vertically.
  Keep bullet lists to 3-4 items. Slides are not documents — be concise.

Layout:
- summary-header: {"type": "summary-header", "title": "...", "subtitle": "...", "stats": [{"label": "...", "value": "..."}]}
- columns: {"type": "columns", "columns": [{"sections": [...]}, {"sections": [...]}]}
- divider: {"type": "divider"}
- spacer: {"type": "spacer", "height": "40px"}

Themes: default, executive, minimal, corporate, dashboard, presentation, earth, highcontrast
Layouts: narrow (640px), standard (800px), wide (1200px), full (100%)

Chart rules:
- labels.length MUST equal each dataset's values.length
- Values must be plain numbers (no "$", "%", or commas)
- Pie/donut segment values must be positive
- Every chart must have a "heading"
- Limit to 10-12 data points per chart for readability

DO NOT:
- Write raw SVG markup — use chart section types, the server renders SVGs from data
- Put SVG or HTML inside code blocks (```...```) — this shows source code, not charts
- Use CSS class names — they are stripped. Use inline style="..." attributes only
- Submit empty sections or placeholder data — the coach will block it'''
