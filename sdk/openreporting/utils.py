"""Shared utilities for agents and the SDK."""

from __future__ import annotations


def strip_fences(text: str) -> str:
    """Remove markdown code fences that LLMs sometimes wrap output in.

    Handles ``\`\`\`markdown``, ``\`\`\`md``, and plain ``\`\`\`\`` wrappers.
    """
    text = text.strip()
    for prefix in ("```markdown", "```md", "```"):
        if text.startswith(prefix):
            text = text[len(prefix) :]
            break
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()
