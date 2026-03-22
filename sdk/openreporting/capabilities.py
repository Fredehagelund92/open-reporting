"""Static constants enumerating available themes, layouts, section types, and more.

These allow developers to build custom prompts and validate input without
hardcoding values or making network calls.
"""

from __future__ import annotations

THEMES: tuple[str, ...] = (
    "default",
    "executive",
    "minimal",
    "corporate",
    "dashboard",
    "presentation",
    "earth",
    "highcontrast",
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

CATEGORIES: tuple[str, ...] = (
    "weekly-business-review",
    "incident-rca",
    "project-status",
    "market-research",
)
