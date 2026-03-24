"""System prompt builder for LLM-powered agents.

Generates a complete system prompt that tells an LLM how to create reports
using the Open Reporting platform. This is the Python equivalent of the
frontend's ``buildAgentConnectPrompt()`` in ``agentPrompts.ts``.

Usage::

    from openreporting import OpenReportingClient

    client = OpenReportingClient(api_key="or_...", base_url="http://localhost:8000")
    prompt = client.build_system_prompt()
    # Pass *prompt* as the system message to any LLM (Claude, GPT, etc.)
"""

from __future__ import annotations


def _role_instruction(skill_ref: str) -> str:
    return (
        "You are a reporting assistant for Open Reporting. "
        f"{skill_ref} "
        "Follow the workflow and rules below when generating reports."
    )


_FORMAT_INSTRUCTION = (
    'Use `markdown_body` (recommended) so the server renders themed HTML. '
    'Alternatives: `structured_body` with `{"sections": [...]}` for dashboard-style '
    "layouts, or `html_body` for full visual control (inline styles only). "
    'Set `content_format` to "auto" (default). '
    "Pick a `theme` (default, executive, minimal, corporate, dashboard, "
    "presentation, earth, or highcontrast) and a `layout` (narrow, standard, "
    "wide, or full) to control content width. "
    'Use `layout: "wide"` or `"full"` with `columns` sections for side-by-side charts.'
)

_CATEGORY_INSTRUCTION = (
    "Select category by intent: Weekly Business Review (default if ambiguous), "
    "Incident/RCA, Project Status, or Market Research. "
    'Use `content_type: "slideshow"` only when a deck/presentation is explicitly '
    'requested, otherwise use "report". '
    "For slideshows, wrap sections in `slide` wrappers to control which content "
    "appears on each slide. Use a dark background_color (e.g. #0f172a) for the "
    "title slide with a summary-header, and white (#ffffff) for content slides. "
    "Each slide should have 1-3 sections for readability."
)

_WORKFLOW_TEMPLATE = (
    "Iteration workflow:\n"
    "1. Show the user a plain-text outline of the planned report structure. "
    "Get approval before generating content.\n"
    "2. Optionally preview with POST {api_base}/reports/preview "
    "(returns rendered HTML + coach feedback, stores nothing).\n"
    "3. Publish with POST {api_base}/reports/ and share the returned report URL "
    "with the user.\n"
    "4. If the user requests changes, call PATCH {api_base}/reports/{{id}} "
    "with only the changed fields -- do NOT publish a new report. "
    "Keep the report ID from the publish response for later updates."
)

_COACH_TEMPLATE = (
    "Before publishing, call POST {api_base}/reports/coach/evaluate with the same "
    'payload. Apply suggested_edits until readiness_status is "ready" (or only '
    "non-blocking warnings remain). The coach checks structure, specificity, "
    "and evidence quality."
)

_SELF_CHECK = (
    "Before final output, run a lightweight self-check: required sections present, "
    "metrics are specific (numbers not vague language), actions have owners and dates, "
    "external claims have evidence or sources, chart labels and values arrays have "
    "matching lengths, chart values are plain numbers (no currency symbols or commas). "
    "Revise once if needed."
)

_CHART_INSTRUCTION = (
    "Chart data is validated server-side. Ensure: labels.length equals values.length "
    "for every dataset, values are plain numbers, pie/donut segments have positive "
    "values, and every chart has a heading."
)

_HTML_CONSTRAINTS = (
    'If using html_body: inline style="..." only (no <style>/<link>/classes). '
    "Forbidden: <iframe>, <form>, position:fixed/absolute. Max 2 MB. "
    "Reports render in a white container (except dashboard theme which uses dark "
    "background) -- use appropriate contrast."
)

_API_QUICK_REF_TEMPLATE = (
    "Key API endpoints (all under {api_base}):\n"
    "- POST /reports/ -- Publish a report (returns id and URL)\n"
    "- PATCH /reports/{{id}} -- Update a report in place (send only changed fields)\n"
    "- POST /reports/preview -- Preview rendered output + coach feedback (no storage)\n"
    "- POST /reports/coach/evaluate -- Run authoring coach without publishing\n"
    "- GET /spaces/ -- List available spaces\n"
    "- GET /tags?limit=20 -- Fetch popular tags for discoverability"
)


def build_system_prompt(
    *,
    api_base: str,
    api_key: str,
    skill_content: str | None = None,
    skill_url: str | None = None,
) -> str:
    """Build a complete system prompt for an LLM to generate reports.

    Parameters
    ----------
    api_base:
        The API base URL, e.g. ``"http://localhost:8000/api/v1"``.
    api_key:
        The agent's API key (included at the end of the prompt).
    skill_content:
        If provided, the full text of skill.md is embedded inline so the LLM
        has the complete reference without needing to fetch a URL.
    skill_url:
        URL where the skill.md can be fetched. Referenced in the prompt when
        *skill_content* is not provided.
    """
    # Build role instruction with appropriate skill reference
    if skill_content:
        skill_ref = "The full content reference is provided below."
    elif skill_url:
        skill_ref = f"Refer to {skill_url} for the full content reference."
    else:
        skill_ref = "Use the format, section type, and chart guidance below."

    sections: list[str] = [_role_instruction(skill_ref)]

    if skill_content:
        sections.append(
            "--- BEGIN SKILL REFERENCE ---\n"
            f"{skill_content.strip()}\n"
            "--- END SKILL REFERENCE ---"
        )

    sections.extend([
        _FORMAT_INSTRUCTION,
        _CATEGORY_INSTRUCTION,
        _WORKFLOW_TEMPLATE.format(api_base=api_base),
        _COACH_TEMPLATE.format(api_base=api_base),
        _SELF_CHECK,
        _CHART_INSTRUCTION,
        _HTML_CONSTRAINTS,
        _API_QUICK_REF_TEMPLATE.format(api_base=api_base),
        f"Your API key is: {api_key}\n"
        f"API Base URL: {api_base}\n\n"
        "Use this key for all Open Reporting API calls and keep it private.",
    ])

    return "\n\n".join(sections)
