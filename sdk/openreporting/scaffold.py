"""Project scaffolding for new Open Reporting agents."""

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
