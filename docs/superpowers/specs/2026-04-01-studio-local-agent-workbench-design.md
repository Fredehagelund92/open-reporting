# Studio: Local Agent Workbench — Design Spec

**Date:** 2026-04-01
**Status:** Approved

---

## Context

After the HTML-first migration, agents are Python scripts that generate full HTML documents and publish them to Open Reporting via the SDK. Before that publish step, teams want to iterate on the report design locally — run the agent with different date inputs, preview the output, tweak the script, re-run — without hitting the Open Reporting API or needing the full platform running.

This tool is the iteration layer. It is also the handoff point to Dagster scheduling: once the agent's `run()` function is proven here, Dagster calls it directly on a cadence.

---

## Agent Contract

Agents are plain Python files with a `run()` function that returns an HTML string. No SDK imports required.

```python
# agents/finance_agent.py
def run(date: str = "2026-04-01") -> str:
    html = fetch_data_and_build_html(date)
    return html

# agents/sales_agent.py
def run(start_date: str = "2026-03-01", end_date: str = "2026-03-31") -> str:
    ...
```

Dagster calls the same `run()` function on a schedule — no adapter, no changes needed.

### Parameter Type Mapping

The studio inspects the function signature and auto-generates UI inputs:

| Parameter name pattern | Type hint | UI input |
|---|---|---|
| `date` | `str` / `datetime.date` | Date picker |
| `start_date`, `end_date` | `str` / `datetime.date` | Date range pickers |
| anything else | `str` | Text input |
| anything else | `int` | Number input |
| anything else | `bool` | Toggle |

Default values pre-fill inputs on load.

---

## Architecture

```
openreporting studio [--dir ./agents] [--port 5999] [--api-key or_...]
  │
  ├── Scans --dir for Python files with a run() function
  ├── Starts Starlette server on localhost:{port}
  └── Opens browser automatically
```

### Server Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Serves `ui.html` |
| `GET` | `/api/agents` | Returns agent list + parameter schemas |
| `POST` | `/api/run` | Imports module, calls `run(**params)`, returns `{ html, error }` |
| `POST` | `/api/publish` | Calls `OpenReportingClient.publish()` with metadata payload |

### Agent Discovery (`agent_loader.py`)

1. Walk `--dir` for `*.py` files (non-recursive, top-level only)
2. For each file: `importlib.util.spec_from_file_location` + `module_from_spec`
3. Check if module has a `run` attribute that is callable
4. Inspect `run.__annotations__` and `inspect.signature(run)` to extract params + defaults
5. Return schema: `{ name, file, params: [{ name, type, default }] }`

Agent modules are **reloaded on each `/api/run` call** (`importlib.reload`) so file edits are picked up without restarting the server.

---

## UI Layout

Built with `/frontend-design` for a polished, production-quality result.

```
┌─────────────────────┬──────────────────────────────────┐
│  Agent              │                                  │
│  [dropdown ▼]       │   HTML Preview                   │
│                     │   (sandboxed iframe,             │
│  Parameters         │    sandbox="allow-scripts")      │
│  date [2026-04-01]  │                                  │
│                     │                                  │
│  [  Run  ]          │                                  │
│                     │                                  │
│  ── Push to OR ──   │                                  │
│  Title [          ] │                                  │
│  Summary [        ] │                                  │
│  Space [o/finance ] │                                  │
│  Tags [           ] │                                  │
│  [ Publish ]        │                                  │
└─────────────────────┴──────────────────────────────────┘
```

**Behavior:**
- Agent dropdown lists discovered agents. Selecting one updates the parameter inputs.
- Run calls `/api/run`, updates the iframe `srcdoc` in-place. Loading state shown during execution.
- Errors (Python exceptions, missing `run()`, import errors) display inline below the Run button with the full traceback.
- "Push to Open Reporting" section is collapsed by default, expands on click.
- Publish calls `/api/publish`. On success shows a link to the published report.
- No page reloads — all interactions are fetch + DOM updates.

---

## Files

### New

| Path | Description |
|---|---|
| `sdk/openreporting/studio/__init__.py` | Package marker |
| `sdk/openreporting/studio/server.py` | Starlette app, routes, startup logic |
| `sdk/openreporting/studio/agent_loader.py` | Directory scanner + signature inspector |
| `sdk/openreporting/studio/ui.html` | Single-file UI (Tailwind CDN + vanilla JS) — built with `/frontend-design` |

### Modified

| Path | Change |
|---|---|
| `sdk/openreporting/cli.py` | Add `studio` Click command |
| `sdk/pyproject.toml` | Add `[studio]` optional extras: `starlette`, `uvicorn` |

---

## CLI Command

```python
@cli.command()
@click.option("--dir", "agents_dir", default=".", help="Directory to scan for agents")
@click.option("--port", default=5999, help="Local port")
@click.option("--api-key", envvar="OPENREPORTING_API_KEY", default=None)
def studio(agents_dir, port, api_key):
    """Start the local agent workbench."""
    ...
```

Opens `http://localhost:{port}` in the default browser after server starts.

---

## Dependencies

Added as optional `[studio]` extra in `pyproject.toml`:

```toml
[project.optional-dependencies]
studio = ["starlette>=0.40", "uvicorn>=0.30"]
```

Install: `pip install openreporting[studio]`

---

## Verification

1. `pip install openreporting[studio]`
2. Create `agents/test_agent.py` with `def run(date: str = "2026-04-01") -> str`
3. `openreporting studio --dir agents/` — browser opens at `localhost:5999`
4. Agent appears in dropdown. Date param shows as date picker with default.
5. Click Run — HTML preview appears in iframe.
6. Edit `test_agent.py`, click Run again — changes picked up without restart.
7. Expand "Push to Open Reporting", fill title/summary/space, click Publish — report appears on platform.
8. Test with `start_date`/`end_date` agent — date range inputs appear.
9. Test Python exception in `run()` — error + traceback shown inline, no server crash.
