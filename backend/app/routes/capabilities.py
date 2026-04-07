"""Capabilities endpoint — returns platform metadata."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/capabilities", tags=["Capabilities"])


@router.get("/")
def get_capabilities():
    """Return the server's supported content format and features.

    No authentication required — this is public server metadata.
    """
    return {
        "content_format": "html",
        "max_html_size_bytes": 2 * 1024 * 1024,
        "rendering": "sandboxed-iframe",
        "javascript_allowed": True,
    }
