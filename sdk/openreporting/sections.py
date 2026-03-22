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
