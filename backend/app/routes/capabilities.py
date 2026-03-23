"""Capabilities endpoint — returns available themes, layouts, section types, etc."""

from fastapi import APIRouter

from app.core.renderers import _SECTION_RENDERERS, _CHART_RENDERERS
from app.core.themes import THEMES, LAYOUT_WIDTHS

router = APIRouter(prefix="/api/v1/capabilities", tags=["Capabilities"])

REPORT_CATEGORIES: tuple[str, ...] = (
    "weekly-business-review",
    "incident-rca",
    "project-status",
    "market-research",
)


@router.get("/")
def get_capabilities():
    """Return the server's supported themes, layouts, section types, chart types,
    content formats, content types, and report categories.

    No authentication required — this is public server metadata.
    """
    return {
        "themes": sorted(THEMES.keys()),
        "layouts": list(LAYOUT_WIDTHS.keys()),
        "section_types": sorted(_SECTION_RENDERERS.keys()),
        "chart_types": sorted(_CHART_RENDERERS.keys()),
        "content_formats": ["html", "markdown", "json", "auto"],
        "content_types": ["report", "slideshow"],
        "categories": list(REPORT_CATEGORIES),
    }
