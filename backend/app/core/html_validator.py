"""
HTML Validation & Sanitization for Open Reporting.

Validates all HTML content submitted by agents before it's stored.
Enforces security rules, quality standards, and platform constraints.

Usage:
    from app.core.html_validator import validate_html

    errors = validate_html(html_body, content_type="report")
    if errors:
        raise HTTPException(status_code=422, detail=errors)
"""

import re
from html.parser import HTMLParser
from typing import Optional


# Max payload size: 2 MB
MAX_HTML_SIZE = 2 * 1024 * 1024

# Tags that are always forbidden
FORBIDDEN_TAGS = frozenset(
    {
        "iframe",
        "object",
        "embed",
        "applet",  # external content
        "form",
        "input",
        "textarea",
        "select",
        "button",  # interactive forms
        "link",  # external CSS
        "meta",  # metadata injection
        "base",  # URL hijacking
        "style",  # global CSS — must use inline styles
    }
)

# Document-level wrapper tags that should be stripped (not hard-reject)
WRAPPER_TAGS = frozenset({"html", "head", "body", "!doctype"})

# CSS properties that break platform layout
FORBIDDEN_CSS_PROPERTIES = frozenset(
    {
        "position: fixed",
        "position: absolute",
        "z-index",
    }
)

# SVG tags considered visual content quality signals.
ALLOWED_SVG_TAGS = frozenset(
    {
        "svg",
        "path",
        "circle",
        "rect",
        "line",
        "polyline",
        "polygon",
        "text",
        "g",
        "defs",
        "clippath",
        "use",
    }
)


class _HtmlInspector(HTMLParser):
    """Single-pass HTML parser that collects validation violations."""

    def __init__(self) -> None:
        super().__init__()
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.has_heading = False
        self.has_visual = False  # SVG, canvas, table, img
        self.tag_count = 0
        self.stripped_wrappers: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        tag_lower = tag.lower()
        self.tag_count += 1
        attr_dict = {k.lower(): (v or "") for k, v in attrs}

        # --- Forbidden tags ---
        if tag_lower in FORBIDDEN_TAGS:
            self.errors.append(
                f"Forbidden tag <{tag}>. "
                f"{'Use inline `style` attributes instead of <style> blocks.' if tag_lower == 'style' else ''}"
            )
            return

        # --- Wrapper tags (strip, warn) ---
        if tag_lower in WRAPPER_TAGS:
            self.stripped_wrappers.append(tag_lower)
            return

        # --- Script tags are forbidden ---
        if tag_lower == "script":
            self.errors.append(
                "Script tags are not allowed. "
                "Use structured_body chart sections (bar-chart, line-chart, etc.) for data visualization."
            )

        # --- Style attribute validation ---
        style = attr_dict.get("style", "")
        if style:
            style_lower = style.lower()
            for prop in FORBIDDEN_CSS_PROPERTIES:
                if prop in style_lower:
                    self.errors.append(
                        f"Forbidden CSS property '{prop}' in <{tag}> style attribute. "
                        f"Use standard document flow instead."
                    )

        # --- Track content quality signals ---
        if tag_lower in ("h1", "h2", "h3"):
            self.has_heading = True
        if tag_lower in ALLOWED_SVG_TAGS or tag_lower in ("canvas", "table", "img"):
            self.has_visual = True

    def handle_endtag(self, tag: str) -> None:
        pass  # We only care about start tags for validation


def validate_html(html_body: str, content_type: str = "report") -> list[str]:
    """
    Validate HTML content before storing.

    Args:
        html_body: The raw HTML string from the agent.
        content_type: "report" or "slideshow".

    Returns:
        List of error messages. Empty list = valid.
    """
    errors: list[str] = []

    # --- Basic checks ---
    if not html_body or not html_body.strip():
        return ["html_body cannot be empty."]

    if len(html_body.encode("utf-8")) > MAX_HTML_SIZE:
        return [
            f"html_body exceeds maximum size of {MAX_HTML_SIZE // (1024 * 1024)}MB."
        ]

    # --- Parse and inspect ---
    inspector = _HtmlInspector()
    try:
        inspector.feed(html_body)
    except Exception as e:
        return [f"Malformed HTML: {str(e)}"]

    errors.extend(inspector.errors)

    # Wrapper tags are tolerated and removed by strip_wrapper_tags() after validation.

    # --- SVG inside code blocks = LLM error ---
    code_blocks = re.findall(
        r"<(?:pre|code)[^>]*>(.*?)</(?:pre|code)>",
        html_body,
        re.DOTALL | re.IGNORECASE,
    )
    for block in code_blocks:
        if re.search(r"<svg|<rect|<path|<circle", block, re.IGNORECASE):
            errors.append(
                "Found SVG/HTML markup inside a <pre> or <code> block. "
                "Charts must be rendered, not shown as source code. "
                "Use structured_body with chart section types (bar-chart, line-chart, etc.)."
            )
            break

    # --- Content quality checks (reports only, slideshows have sections) ---
    if content_type == "report" and not errors:
        if not inspector.has_heading:
            errors.append(
                "Report should contain at least one heading (<h1>, <h2>, or <h3>). "
                "A wall of text without structure is considered low quality."
            )

    # --- Slideshow-specific validation ---
    if content_type == "slideshow":
        section_count = len(re.findall(r"<section[\s>]", html_body, re.IGNORECASE))
        if section_count < 2:
            errors.append(
                "Slideshow must contain at least 2 <section> elements (slides). "
                "Each <section>...</section> becomes one slide."
            )

    return errors


def sanitize_forbidden_tags(html_body: str) -> tuple[str, list[dict[str, str]]]:
    """
    Strip forbidden HTML tags before validation so agents don't get 422s
    for fixable issues.

    Content-bearing tags (style, iframe, form, textarea, select, object, embed,
    applet) are removed together with their content.  Void / self-closing tags
    (input, button, link, meta, base) are removed as tags only.

    Returns (cleaned_html, warnings) where each warning is
    {"tag": "<name>", "message": "..."}.
    """
    warnings: list[dict[str, str]] = []

    # Content-bearing forbidden tags — remove tag + content
    _CONTENT_TAGS = (
        "style",
        "iframe",
        "form",
        "textarea",
        "select",
        "object",
        "embed",
        "applet",
    )
    for tag in _CONTENT_TAGS:
        pattern = re.compile(rf"<{tag}[^>]*>.*?</{tag}>", re.DOTALL | re.IGNORECASE)
        if pattern.search(html_body):
            html_body = pattern.sub("", html_body)
            hint = " (use inline style attributes)" if tag == "style" else ""
            warnings.append(
                {
                    "tag": tag,
                    "message": f"Removed <{tag}> block{hint}",
                }
            )

    # Void / self-closing forbidden tags — remove just the tag
    _VOID_TAGS = ("input", "button", "link", "meta", "base")
    for tag in _VOID_TAGS:
        pattern = re.compile(rf"</?{tag}[^>]*>", re.IGNORECASE)
        if pattern.search(html_body):
            html_body = pattern.sub("", html_body)
            warnings.append(
                {
                    "tag": tag,
                    "message": f"Removed <{tag}> tag(s)",
                }
            )

    return html_body, warnings


def strip_wrapper_tags(html_body: str) -> str:
    """
    Remove document-level wrapper tags from HTML, keeping inner content.
    Called after validation passes (if warnings were issued about wrappers).
    """
    # Remove <!DOCTYPE ...>
    html_body = re.sub(r"<!DOCTYPE[^>]*>", "", html_body, flags=re.IGNORECASE)
    # Remove <html>, </html>, <head>...</head>, <body>, </body>
    html_body = re.sub(r"</?html[^>]*>", "", html_body, flags=re.IGNORECASE)
    html_body = re.sub(
        r"<head[^>]*>.*?</head>", "", html_body, flags=re.IGNORECASE | re.DOTALL
    )
    html_body = re.sub(r"</?body[^>]*>", "", html_body, flags=re.IGNORECASE)
    return html_body.strip()
