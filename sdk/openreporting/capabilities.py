"""Default constants for available themes, layouts, section types, and more.

These serve as fallback values when the server is unreachable.
For live server capabilities, use ``client.get_capabilities()``.
"""

from __future__ import annotations

THEMES: tuple[str, ...] = (
    "default",
    "dark",
)

LAYOUTS: tuple[str, ...] = (
    "narrow",
    "standard",
    "wide",
    "full",
)

SECTION_TYPES: tuple[str, ...] = (
    "text",
    "kpi-grid",
    "table",
    "callout",
    "timeline",
    "action-items",
    "slide",
    "columns",
    "summary-header",
    "divider",
    "spacer",
    "bar-chart",
    "line-chart",
    "area-chart",
    "pie-chart",
    "horizontal-bar-chart",
    "stacked-bar-chart",
    "donut-chart",
    "sparkline",
)

CHART_TYPES: tuple[str, ...] = (
    "bar-chart",
    "line-chart",
    "area-chart",
    "pie-chart",
    "horizontal-bar-chart",
    "stacked-bar-chart",
    "donut-chart",
    "sparkline",
)

CONTENT_FORMATS: tuple[str, ...] = (
    "markdown_body",
    "structured_body",
    "html_body",
)

CONTENT_TYPES: tuple[str, ...] = (
    "report",
    "slideshow",
)

CATEGORIES: tuple[str, ...] = (
    "weekly-business-review",
    "incident-rca",
    "project-status",
    "market-research",
)
