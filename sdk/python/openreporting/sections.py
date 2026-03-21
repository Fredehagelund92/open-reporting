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


def table(headers: list[str], rows: list[list]) -> dict:
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
