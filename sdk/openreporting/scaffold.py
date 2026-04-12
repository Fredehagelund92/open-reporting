"""Project scaffolding for new Open Reporting agents."""
from pathlib import Path

AGENT_TEMPLATE = '''"""
{agent_name} — Open Reporting Agent

Publishes HTML reports to the Open Reporting platform.
"""

from openreporting import OpenReportingClient

client = OpenReportingClient(
    api_key="YOUR_API_KEY",
    base_url="http://localhost:8000/api/v1",
)

# Build your HTML report
html = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }}
        h1 {{ color: #1a1a2e; }}
        .metric {{ display: inline-block; padding: 1rem; margin: 0.5rem; background: #f8f9fa; border-radius: 8px; }}
        .metric .value {{ font-size: 2rem; font-weight: bold; }}
        .metric .label {{ color: #666; font-size: 0.9rem; }}
    </style>
</head>
<body>
    <h1>My First Report</h1>
    <p>This is a sample report. Replace this with your own content.</p>

    <div class="metric">
        <div class="value">42</div>
        <div class="label">Key Metric</div>
    </div>
</body>
</html>
"""

# Publish
report = client.publish(
    title="My First Report",
    summary="A sample report to get started.",
    html=html,
    space="o/general",
    tags=["getting-started"],
)

print(f"Published: {{report.slug}}")
'''


def scaffold_agent(agent_name: str, output_dir: str = ".") -> str:
    """Generate a starter agent script."""
    import os

    filename = agent_name.lower().replace(" ", "_") + "_agent.py"
    filepath = os.path.join(output_dir, filename)

    content = AGENT_TEMPLATE.format(agent_name=agent_name)

    with open(filepath, "w") as f:
        f.write(content)

    return filepath


# ---------------------------------------------------------------------------
# Multi-file agent scaffold (for ReportAgent-based projects)
# ---------------------------------------------------------------------------

def scaffold_multifile_agent(
    name: str,
    dataset_name: str = "",
    mission: str = "",
    output_dir: str = ".",
) -> str:
    """Generate a multi-file agent directory with ReportAgent stubs.

    Creates a complete agent directory that runs in Studio immediately
    with placeholder HTML. Developer fills in SQL, tools, templates,
    and prompts.
    """
    import re

    if not dataset_name:
        dataset_name = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

    # Class name: "Partner Health" -> "PartnerHealth"
    class_name = "".join(word.capitalize() for word in name.split())

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Subdirectories
    for subdir in ["sql", "templates", "prompts", "descriptions"]:
        (out / subdir).mkdir(exist_ok=True)

    # __init__.py
    (out / "__init__.py").write_text("")

    # agent.py
    (out / "agent.py").write_text(f'''"""
{name} Agent — ReportAgent subclass.
"""
from __future__ import annotations

from core.agent_base import ReportAgent
from core.tools.sql import DataLayer


class {class_name}Agent(ReportAgent):
    dataset_name = "{dataset_name}"
    mission = "{mission}"

    payload_class = ...  # Your Pydantic model — define in tools.py or schemas.py
    studio_params = []   # Studio form fields, e.g. [("month", str, "2026-03")]
    jinja_filters = {{}}

    def build_data(self, data_layer, context):
        # Implement your data logic here.
        # See agents/fp_and_a/tools.py:build_report() for a complete example.
        raise NotImplementedError

    async def enrich(self, payload, context):
        # Optional: add LLM-generated narratives to the payload.
        # See agents/fp_and_a/tools.py:generate_narratives() for an example.
        return payload

    def snapshot_key(self, context):
        # Return the cache key for snapshot/replay.
        # FP&A uses context["month"], Data Steward uses "latest".
        return "default"
''')

    # studio_run.py — runnable immediately, no NotImplementedError on first run
    (out / "studio_run.py").write_text(f'''"""
Studio wrapper for {name} Agent.
Usage: openreporting studio --dir agents/
"""
from __future__ import annotations

from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent

STUDIO_NAME = "{name}"
STUDIO_DESCRIPTION = "{mission or 'Describe what this agent analyses.'}"

STUDIO_REPORTS = {{
    "{name}": {{
        "fn": "run",
        # Description shown before running — edit descriptions/{dataset_name}.html
        # for a rich HTML description, or the loader will use this fallback.
        "description": "<p>{name}. Edit this description in <code>descriptions/{dataset_name}.html</code>.</p>",
    }},
}}


def run(month: str = "") -> str:
    """Starter report — replace with real logic.

    Return an HTML string.  The Studio file-watcher will auto-reload this
    file (and anything else in this directory) when you save changes.
    """
    import datetime
    period = month or datetime.date.today().strftime("%Y-%m")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{name}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: system-ui, -apple-system, sans-serif; background: #f8f7f4; color: #1a1a1a; padding: 48px 56px; }}
    h1   {{ font-size: 28px; font-weight: 700; margin-bottom: 6px; }}
    .sub {{ font-size: 14px; color: #666; margin-bottom: 40px; }}
    .kpis {{ display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 40px; }}
    .kpi  {{ background: #fff; border-radius: 10px; padding: 20px 24px; min-width: 160px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }}
    .kpi-v {{ font-size: 32px; font-weight: 700; line-height: 1.1; }}
    .kpi-l {{ font-size: 12px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }}
    .card {{ background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }}
    .card h2 {{ font-size: 16px; font-weight: 600; margin-bottom: 16px; }}
    p    {{ color: #555; line-height: 1.6; }}
    .chip {{ display: inline-block; background: #e8f5e9; color: #2e7d32; border-radius: 4px; font-size: 12px; padding: 2px 8px; margin-top: 4px; }}
  </style>
</head>
<body>
  <h1>{name}</h1>
  <p class="sub">Period: {{period}} &nbsp;·&nbsp; Generated by Studio</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-v">—</div><div class="kpi-l">Metric A</div></div>
    <div class="kpi"><div class="kpi-v">—</div><div class="kpi-l">Metric B</div></div>
    <div class="kpi"><div class="kpi-v">—</div><div class="kpi-l">Metric C</div></div>
  </div>
  <div class="card">
    <h2>Getting started</h2>
    <p>This is a placeholder report for the <strong>{name}</strong> agent.</p>
    <p style="margin-top:12px">Replace the <code>run()</code> function in <code>studio_run.py</code> with your real logic — query a database, call an API, or call an LLM. Return an HTML string.</p>
    <span class="chip">✓ Studio is watching this directory for changes</span>
  </div>
</body>
</html>"""


# When your agent class is ready, replace `run` above with:
# from openreporting.studio.helpers import make_run
# from .agent import {class_name}Agent
# async def _factory(): return {class_name}Agent(...)
# STUDIO_AGENT_FACTORY = _factory
# run = make_run({class_name}Agent, _factory)
''')

    # tools.py
    (out / "tools.py").write_text(f'''"""
Business logic for {name} Agent.
"""
from __future__ import annotations

from pathlib import Path

from core.tools.sql import DataLayer

AGENT_DIR = Path(__file__).resolve().parent
PROMPTS_DIR = AGENT_DIR / "prompts"


def build_report(data_layer: DataLayer) -> ...:
    """Build the report payload.

    See agents/fp_and_a/tools.py:build_report() for a complete example.
    """
    raise NotImplementedError
''')

    # templates/report.html.j2
    (out / "templates" / "report.html.j2").write_text('''{%- extends "base_report.html.j2" -%}

{% block title %}''' + name + '''{% endblock %}
{% block masthead_type %}''' + name + '''{% endblock %}
{% block headline %}<h1>''' + name + ''' Report</h1>{% endblock %}

{% block kpi_strip %}
<!-- Define your KPI strip cells here -->
{% endblock %}

{% block body %}
<section style="padding: 40px 56px;">
  <p>Report template ready. Add your content blocks here.</p>
</section>
{% endblock %}
''')

    # .gitkeep files
    for subdir in ["sql", "prompts", "descriptions"]:
        (out / subdir / ".gitkeep").write_text("")

    return str(out)


# ---------------------------------------------------------------------------
# Quick-start Studio templates (single-file, no external deps)
# ---------------------------------------------------------------------------

_DASHBOARD_TEMPLATE = '''"""
{name} — Data Dashboard
Studio quick-start template. Replace sample data with your own queries.
"""
from __future__ import annotations
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent

STUDIO_NAME = "{name}"
STUDIO_DESCRIPTION = "KPI dashboard with summary metrics and a data table."

STUDIO_REPORTS = {{
    "{name}": {{
        "fn": "run",
        "description": "<p>A <strong>data dashboard</strong> with KPI cards and a summary table. Replace sample data with your own SQL queries or API calls.</p>",
    }},
}}


def run(period: str = "2026-Q1") -> str:
    """Return an HTML dashboard. Replace the sample_rows with real data."""
    sample_rows = [
        ("ACME Corp",     "$142,300", "+12%", "Active"),
        ("Globex Inc",    "$98,750",  "+4%",  "Active"),
        ("Initech LLC",   "$67,200",  "-3%",  "At risk"),
        ("Umbrella Co",   "$55,400",  "+8%",  "Active"),
        ("Soylent Corp",  "$34,100",  "-11%", "Churned"),
    ]
    rows_html = "\\n".join(
        f"""<tr>
          <td>{r[0]}</td><td style="text-align:right">{r[1]}</td>
          <td style="text-align:right;color:{'#16a34a' if r[2].startswith('+') else '#dc2626'}">{r[2]}</td>
          <td><span class="badge badge-{{'active' if r[3]=='Active' else 'risk' if r[3]=='At risk' else 'churn'}}">{r[3]}</span></td>
        </tr>"""
        for r in sample_rows
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{name}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:system-ui,-apple-system,sans-serif;background:#f5f4f0;color:#1a1a1a;padding:48px 56px}}
    h1{{font-size:26px;font-weight:700;margin-bottom:4px}}
    .sub{{font-size:13px;color:#888;margin-bottom:36px}}
    .kpis{{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:36px}}
    .kpi{{background:#fff;border-radius:10px;padding:18px 22px;min-width:150px;box-shadow:0 1px 3px rgba(0,0,0,.07)}}
    .kpi-v{{font-size:28px;font-weight:700;line-height:1.1}}
    .kpi-l{{font-size:11px;color:#999;margin-top:3px;text-transform:uppercase;letter-spacing:.05em}}
    .kpi-d{{font-size:12px;color:#16a34a;margin-top:2px;font-weight:500}}
    .card{{background:#fff;border-radius:10px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.07)}}
    .card h2{{font-size:15px;font-weight:600;margin-bottom:16px}}
    table{{width:100%;border-collapse:collapse}}
    th{{text-align:left;font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.05em;padding:0 12px 10px}}
    td{{padding:10px 12px;border-top:1px solid #f0eeea;font-size:13px}}
    tr:hover td{{background:#faf9f6}}
    .badge{{display:inline-block;border-radius:4px;font-size:11px;padding:2px 7px;font-weight:500}}
    .badge-active{{background:#dcfce7;color:#15803d}}
    .badge-risk{{background:#fef9c3;color:#a16207}}
    .badge-churn{{background:#fee2e2;color:#b91c1c}}
  </style>
</head>
<body>
  <h1>{name}</h1>
  <p class="sub">Period: {{period}} &nbsp;·&nbsp; Sample data — replace with your own source</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-v">$397k</div><div class="kpi-l">Total Revenue</div><div class="kpi-d">↑ 4.2% vs last period</div></div>
    <div class="kpi"><div class="kpi-v">5</div><div class="kpi-l">Accounts</div><div class="kpi-d">3 active</div></div>
    <div class="kpi"><div class="kpi-v">79.5k</div><div class="kpi-l">Avg Deal Size</div><div class="kpi-d">↑ 1.8%</div></div>
    <div class="kpi"><div class="kpi-v">60%</div><div class="kpi-l">Retention</div><div class="kpi-d">↓ 2 churned</div></div>
  </div>
  <div class="card">
    <h2>Accounts by Revenue</h2>
    <table>
      <thead><tr><th>Account</th><th style="text-align:right">Revenue</th><th style="text-align:right">Change</th><th>Status</th></tr></thead>
      <tbody>{{rows_html}}</tbody>
    </table>
  </div>
</body>
</html>"""
'''

_NARRATIVE_TEMPLATE = '''"""
{name} — Narrative Report
Studio quick-start template. Replace placeholders with LLM-generated narratives.
"""
from __future__ import annotations
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent

STUDIO_NAME = "{name}"
STUDIO_DESCRIPTION = "Narrative analysis report with executive summary and key findings."

STUDIO_REPORTS = {{
    "{name}": {{
        "fn": "run",
        "description": "<p>A <strong>narrative report</strong> with executive summary and key findings. Wire up an LLM to generate the prose from your data.</p>",
    }},
}}


def run(period: str = "2026-Q1") -> str:
    """Return an HTML narrative report. Replace placeholder text with LLM output."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{name}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:Georgia,'Times New Roman',serif;background:#fdfcf8;color:#1a1a1a;padding:64px 80px;max-width:860px;margin:0 auto}}
    .eyebrow{{font-family:system-ui,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#b08b5a;margin-bottom:8px}}
    h1{{font-size:32px;font-weight:700;line-height:1.2;margin-bottom:6px}}
    .meta{{font-family:system-ui,sans-serif;font-size:13px;color:#888;margin-bottom:48px;padding-bottom:24px;border-bottom:1px solid #e8e4d8}}
    h2{{font-family:system-ui,sans-serif;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#b08b5a;margin:36px 0 14px}}
    p{{font-size:16px;line-height:1.75;color:#333;margin-bottom:16px}}
    .highlight{{background:#fef9ed;border-left:3px solid #b08b5a;padding:16px 20px;margin:24px 0;border-radius:0 6px 6px 0}}
    .highlight p{{margin:0;font-size:15px}}
    .findings{{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}}
    .finding{{background:#fff;border:1px solid #e8e4d8;border-radius:8px;padding:16px 18px}}
    .finding-num{{font-family:system-ui,sans-serif;font-size:24px;font-weight:700;color:#b08b5a;line-height:1}}
    .finding-label{{font-family:system-ui,sans-serif;font-size:12px;color:#999;margin-top:2px}}
    .finding-note{{font-family:system-ui,sans-serif;font-size:13px;color:#555;margin-top:8px;line-height:1.5}}
    .placeholder{{font-family:system-ui,sans-serif;font-size:12px;color:#bbb;border:1px dashed #ddd;border-radius:6px;padding:14px 18px;margin-bottom:16px;line-height:1.6}}
  </style>
</head>
<body>
  <div class="eyebrow">{name}</div>
  <h1>Quarterly Analysis</h1>
  <div class="meta">Period: {{period}} &nbsp;·&nbsp; Generated by Studio &nbsp;·&nbsp; Sample narrative</div>

  <h2>Executive Summary</h2>
  <div class="highlight">
    <p>This is a placeholder executive summary. Replace this with a 2–3 sentence LLM-generated synopsis of your data. Keep it crisp — the reader should finish this paragraph with a clear takeaway.</p>
  </div>

  <h2>Key Findings</h2>
  <div class="findings">
    <div class="finding"><div class="finding-num">+12%</div><div class="finding-label">Revenue Growth</div><div class="finding-note">Replace with your metric and LLM-generated context.</div></div>
    <div class="finding"><div class="finding-num">3 of 5</div><div class="finding-label">Goals Met</div><div class="finding-note">Replace with your metric and LLM-generated context.</div></div>
    <div class="finding"><div class="finding-num">2</div><div class="finding-label">Risks Identified</div><div class="finding-note">Replace with your metric and LLM-generated context.</div></div>
    <div class="finding"><div class="finding-num">↑</div><div class="finding-label">Trend</div><div class="finding-note">Replace with your metric and LLM-generated context.</div></div>
  </div>

  <h2>Detailed Analysis</h2>
  <div class="placeholder">⬡ Wire up an LLM here — call your model with the data payload and insert the generated narrative.<br>Example: <code>narrative = llm.generate(prompt, data)</code> → insert into this section.</div>
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. This paragraph represents LLM-generated prose. Replace it with your <code>enrich()</code> method output that turns raw data into readable narrative analysis.</p>

  <h2>What to Do Next</h2>
  <div class="placeholder">⬡ Add recommendations here. These can be LLM-generated ("given the data, the top 3 actions are...") or rule-based.</div>
</body>
</html>"""
'''

_MONITORING_TEMPLATE = '''"""
{name} — Monitoring Dashboard
Studio quick-start template. Replace sample checks with your real monitors.
"""
from __future__ import annotations
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent

STUDIO_NAME = "{name}"
STUDIO_DESCRIPTION = "Data quality and system monitoring dashboard with status indicators."

STUDIO_REPORTS = {{
    "{name}": {{
        "fn": "run",
        "description": "<p>A <strong>monitoring dashboard</strong> with status indicators, alert flags, and data quality checks. Replace sample checks with your own queries.</p>",
    }},
}}


def run() -> str:
    """Return an HTML monitoring dashboard. Replace checks with your own logic."""
    import datetime
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

    checks = [
        ("Daily Revenue Load",     "ok",   "Loaded 4,823 rows",        "2 min ago"),
        ("Customer Sync",          "ok",   "All records matched",      "8 min ago"),
        ("Churn Score Pipeline",   "warn", "3 accounts flagged",       "15 min ago"),
        ("Email Bounce Rate",      "warn", "Rate at 4.2% (limit 5%)",  "22 min ago"),
        ("Subscription Renewal",   "err",  "Timeout after 30s",        "31 min ago"),
        ("Invoice Reconciliation", "ok",   "Zero discrepancies",       "1 hr ago"),
        ("Product Usage Ingest",   "ok",   "Schema validated",         "2 hr ago"),
        ("Segment Export",         "err",  "API returned 503",         "3 hr ago"),
    ]

    rows_html = "\\n".join(
        f"""<tr>
          <td><span class="dot dot-{{c[1]}}"></span> {{c[0]}}</td>
          <td class="msg">{{c[2]}}</td>
          <td class="age">{{c[3]}}</td>
        </tr>"""
        for c in checks
    )

    ok_n   = sum(1 for c in checks if c[1] == "ok")
    warn_n = sum(1 for c in checks if c[1] == "warn")
    err_n  = sum(1 for c in checks if c[1] == "err")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{name}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:system-ui,-apple-system,sans-serif;background:#0f1117;color:#e2e8f0;padding:40px 48px}}
    h1{{font-size:20px;font-weight:600;margin-bottom:4px}}
    .sub{{font-size:12px;color:#64748b;margin-bottom:32px}}
    .summary{{display:flex;gap:12px;margin-bottom:32px}}
    .s-card{{background:#1a1f2e;border-radius:8px;padding:14px 20px;display:flex;align-items:center;gap:12px}}
    .s-num{{font-size:26px;font-weight:700;line-height:1}}
    .s-label{{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}}
    .ok-c .s-num{{color:#22c55e}} .warn-c .s-num{{color:#eab308}} .err-c .s-num{{color:#ef4444}}
    .card{{background:#1a1f2e;border-radius:8px;padding:20px 24px}}
    .card h2{{font-size:13px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px}}
    table{{width:100%;border-collapse:collapse}}
    td{{padding:9px 0;border-top:1px solid #1e2535;font-size:13px;vertical-align:middle}}
    td:first-child{{display:flex;align-items:center;gap:9px}}
    .msg{{color:#94a3b8;font-size:12px}} .age{{color:#475569;font-size:12px;white-space:nowrap;text-align:right}}
    .dot{{width:8px;height:8px;border-radius:50%;flex-shrink:0}}
    .dot-ok{{background:#22c55e;box-shadow:0 0 6px #22c55e88}}
    .dot-warn{{background:#eab308;box-shadow:0 0 6px #eab30888}}
    .dot-err{{background:#ef4444;box-shadow:0 0 6px #ef444488;animation:pulse-red 1.4s ease-in-out infinite}}
    @keyframes pulse-red{{0%,100%{{opacity:1}}50%{{opacity:.4}}}}
    .ts{{font-size:11px;color:#334155;margin-top:24px;text-align:right}}
  </style>
</head>
<body>
  <h1>{name}</h1>
  <p class="sub">Sample monitoring dashboard — replace checks with your real data</p>
  <div class="summary">
    <div class="s-card ok-c"><div><div class="s-num">{{ok_n}}</div><div class="s-label">Passing</div></div></div>
    <div class="s-card warn-c"><div><div class="s-num">{{warn_n}}</div><div class="s-label">Warnings</div></div></div>
    <div class="s-card err-c"><div><div class="s-num">{{err_n}}</div><div class="s-label">Errors</div></div></div>
  </div>
  <div class="card">
    <h2>Check Status</h2>
    <table>
      <tbody>{{rows_html}}</tbody>
    </table>
  </div>
  <p class="ts">Last updated: {{now}} &nbsp;·&nbsp; Studio sample data</p>
</body>
</html>"""
'''


def scaffold_studio_template(template: str, name: str, output_dir: str = ".") -> str:
    """Create a single-file studio_run.py from a quick-start template.

    Args:
        template: One of "dashboard", "narrative", "monitoring".
        name: Human-readable report name (e.g. "Revenue Dashboard").
        output_dir: Directory where the agent folder will be created.

    Returns:
        Path to the created directory.
    """
    import re

    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "my_report"
    out = Path(output_dir) / slug
    out.mkdir(parents=True, exist_ok=True)

    templates = {
        "dashboard":  _DASHBOARD_TEMPLATE,
        "narrative":  _NARRATIVE_TEMPLATE,
        "monitoring": _MONITORING_TEMPLATE,
    }
    content = templates.get(template, _DASHBOARD_TEMPLATE).format(name=name)
    (out / "studio_run.py").write_text(content, encoding="utf-8")
    return str(out)
