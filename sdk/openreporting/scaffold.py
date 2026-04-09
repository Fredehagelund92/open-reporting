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

    # studio_run.py
    (out / "studio_run.py").write_text(f'''"""
Studio wrapper for {name} Agent.
Usage: openreporting studio --dir agents/
"""
from __future__ import annotations

from pathlib import Path

from openreporting.studio.helpers import make_run

AGENT_DIR = Path(__file__).resolve().parent

STUDIO_NAME = "{name}"
STUDIO_DESCRIPTION = "{mission}"
STUDIO_REPORTS = {{
    "{name}": {{
        "fn": "run",
        "description": "<p>{name} report. Edit descriptions/{dataset_name}.html for a rich description.</p>",
    }},
}}

# Uncomment when agent class is implemented:
# run = make_run({class_name}Agent)
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
