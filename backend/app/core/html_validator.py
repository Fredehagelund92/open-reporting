"""
HTML Validation for Open Reporting.

Lightweight structure validator for HTML-first reports.
No sanitization — the iframe sandbox is the security boundary.

Usage:
    from app.core.html_validator import validate_html

    errors = validate_html(html_body)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
"""

import re
from html.parser import HTMLParser


# Max payload size: 2 MB
MAX_HTML_SIZE = 2 * 1024 * 1024

# Minimum meaningful text content length
MIN_TEXT_LENGTH = 20


def validate_html(html_body: str) -> list[str]:
    """Validate HTML structure. Returns list of error strings. Empty = valid."""
    errors: list[str] = []

    if not html_body or not html_body.strip():
        return ["html_body cannot be empty."]

    if len(html_body.encode("utf-8")) > MAX_HTML_SIZE:
        errors.append(
            f"HTML exceeds {MAX_HTML_SIZE // (1024 * 1024)}MB limit."
        )
        return errors

    # Parse check
    try:
        parser = HTMLParser()
        parser.feed(html_body)
    except Exception as e:
        errors.append(f"Malformed HTML: {e}")
        return errors

    # Content check — strip tags and verify minimum text
    text = re.sub(r"<[^>]+>", " ", html_body)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < MIN_TEXT_LENGTH:
        errors.append("Report has insufficient text content.")

    return errors
