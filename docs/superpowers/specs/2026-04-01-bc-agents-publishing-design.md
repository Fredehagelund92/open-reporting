# Spec: bc-agents → open-reporting Publishing Integration

**Date:** 2026-04-01

---

## Context

bc-agents generates reports from multiple agents (fp_and_a, data_steward, and future agents). Currently these reports are stored internally in bc-agents' SQLite database and served via API endpoints — but there is no shared surface where the wider org can read them.

open-reporting is being built as that shared surface: a publication platform where agents push HTML reports and the wider org reads, discusses, and reacts. This spec covers the first integration step: making bc-agents automatically publish reports to open-reporting when they are generated.

---

## What We're Building

When `POST /reports/generate` is called in bc-agents and the agent produces a report, the API route also publishes the HTML to open-reporting. The report appears in the right team space, grouped with previous runs of the same report type as a navigable series.

This is one-directional for now: bc-agents → open-reporting. The reverse direction (human interactions in open-reporting feeding back to bc-agents) is future work.

---

## Flow

```
POST /reports/generate
  → agent.analyze(context)          existing
  → store snapshot in bc-agents DB  existing
  → publish_report() to OR          NEW — try/except, non-blocking
  → return report_data to caller    existing
```

If open-reporting is unreachable or `OPENREPORTING_API_KEY` is not set, report generation succeeds regardless. A warning is logged but nothing breaks. Publishing is best-effort.

---

## Space Routing

Spaces are organised by team (the audience), not by agent (the publisher).

| Agent | Space | Rationale |
|---|---|---|
| `fp_and_a` | `finance` | FPA reports are consumed by the finance team |
| `data_steward` | `data-quality` | Data quality reports are consumed by data/BI teams |

New agents added to bc-agents get an entry in the routing config at that time.

---

## What Gets Published

Each report published to open-reporting carries:

| Field | Value | Source |
|---|---|---|
| `title` | `"FP&A Report — March 2026"` | Agent name + period from context |
| `summary` | One-paragraph description | `output.output_summary` from agent |
| `html` | Full rendered report | Snapshot HTML from `agent.analyze()` |
| `space` | `finance` / `data-quality` | Routing config |
| `series_id` | `fp_and_a_monthly` | Agent name + period type |
| `series_order` | `20260301` | Period start as YYYYMMDD int |
| `tags` | `["fp-and-a", "monthly"]` | Agent name + period type |

`series_id` groups all monthly FPA runs together so open-reporting renders them as a navigable series (tab or arrow navigation between runs). A user reading the March report can click back to February without leaving the page.

---

## Files to Change (in bc-agents)

### New: `core/publishing.py`

Owns the routing config and the `publish_report()` helper.

```python
AGENT_PUBLISHING = {
    "fp_and_a": {
        "space": "finance",
        "tags": ["fp-and-a"],
    },
    "data_steward": {
        "space": "data-quality",
        "tags": ["data-steward"],
    },
}

async def publish_report(client, agent_name, context, output, html) -> str | None:
    """Publish report to open-reporting. Returns slug or None on failure."""
    ...
```

### Modified: `api/routes/reports.py`

After `agent.analyze()`, calls `publish_report()` in a try/except.

### Modified: `api/main.py`

Initialises `openreporting.Client(api_key=settings.OPENREPORTING_API_KEY)` at startup if key is present. Stored on `app.state.or_client`. If key is absent, `app.state.or_client = None` and publishing is skipped.

### Modified: `requirements.txt` / `pyproject.toml`

Add `openreporting` dependency.

---

## One-Time Setup in open-reporting

Before the integration works, a human needs to:

1. Create `finance` space in open-reporting
2. Create `data-quality` space in open-reporting
3. Create a bc-agents agent entry and generate its API key
4. Set `OPENREPORTING_API_KEY=<key>` in bc-agents environment

This is ops setup, not code.

---

## Out of Scope

- Human interactions in open-reporting (comments, decisions) feeding back to bc-agents — future work
- Changes to open-reporting itself — none required for this integration
- data_steward agent publishing — the agent doesn't exist yet; the routing config entry will be ready when it does

---

## Verification

1. Set `OPENREPORTING_API_KEY` in bc-agents `.env`
2. `POST /reports/generate` with a valid period
3. Check open-reporting `finance` space — report should appear
4. Run again for a different period — both reports should appear as a series with navigation
5. Unset `OPENREPORTING_API_KEY`, run again — report generates normally, no publish attempt, warning in logs
