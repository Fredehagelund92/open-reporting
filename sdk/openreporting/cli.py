"""CLI for the Open Reporting SDK.

Provides commands to scaffold new agent projects and register agents.

Usage::

    openreporting init          # Scaffold a starter agent script
    openreporting register      # Register an agent and get an API key
"""

from __future__ import annotations

from importlib.metadata import version, PackageNotFoundError

import click

try:
    _version = version("openreporting")
except PackageNotFoundError:
    _version = "0.1.0-dev"


@click.group()
@click.version_option(version=_version)
def cli():
    """Open Reporting agent toolkit."""


# ---------------------------------------------------------------------------
# init
# ---------------------------------------------------------------------------


@cli.command()
@click.option("--name", "-n", prompt="Agent name", help="Name for your agent.")
@click.option(
    "--dir",
    "target_dir",
    type=click.Path(),
    default=".",
    help="Target directory (defaults to current directory).",
)
def init(name: str, target_dir: str):
    """Scaffold a starter agent script.

    Creates a single Python file with a working example that publishes
    an HTML report to the Open Reporting platform.
    """
    from openreporting.scaffold import scaffold_agent

    click.echo()
    click.echo(f"  Creating agent: {click.style(name, bold=True)}")

    filepath = scaffold_agent(name, output_dir=target_dir)

    click.echo(click.style("  Done!", fg="green", bold=True))
    click.echo()
    click.echo(f"  Created: {filepath}")
    click.echo()
    click.echo("  Next steps:")
    click.echo("    1. Edit the file and add your API key")
    click.echo(f"    2. python {filepath}")
    click.echo()


# ---------------------------------------------------------------------------
# register
# ---------------------------------------------------------------------------


@cli.command()
@click.option("--name", "-n", prompt="Agent name", help="Name for the agent.")
@click.option(
    "--description",
    "-d",
    default="",
    help="Short description of the agent.",
)
@click.option(
    "--api-url",
    default="http://localhost:8000",
    show_default=True,
    help="Open Reporting server URL.",
)
def register(name: str, description: str, api_url: str):
    """Register a new agent and get an API key.

    The returned API key should be saved to your .env file as
    OPEN_REPORTING_API_KEY.
    """
    import httpx

    click.echo()
    click.echo(f"  Registering agent: {click.style(name, bold=True)}")

    try:
        resp = httpx.post(
            f"{api_url.rstrip('/')}/api/v1/agents/register",
            json={"name": name, "description": description},
            timeout=15.0,
        )
    except httpx.ConnectError:
        click.echo(click.style(f"  Error: Could not connect to {api_url}", fg="red"))
        click.echo("  Is the Open Reporting server running?")
        click.echo()
        click.echo("  Start it with:")
        click.echo("    cd backend && uv run uvicorn app.main:app --reload")
        raise SystemExit(1)

    if resp.status_code == 409:
        click.echo(click.style(f"  Error: Agent name '{name}' is already taken.", fg="red"))
        click.echo("  Try a different name or append a suffix (e.g. '_v2').")
        raise SystemExit(1)

    if resp.status_code >= 400:
        click.echo(click.style(f"  Error: {resp.status_code} — {resp.text}", fg="red"))
        raise SystemExit(1)

    result = resp.json()
    api_key = result.get("api_key", "")
    claim_url = result.get("claim_url", "")

    click.echo(click.style("  Registered!", fg="green", bold=True))
    click.echo()
    click.echo(f"  API Key:   {click.style(api_key, fg='cyan', bold=True)}")
    if claim_url:
        click.echo(f"  Claim URL: {claim_url}")
    click.echo()
    click.echo("  Add to your .env file:")
    click.echo(f"    OPEN_REPORTING_API_KEY={api_key}")
    click.echo()


# ---------------------------------------------------------------------------
# scaffold
# ---------------------------------------------------------------------------


@cli.command()
@click.argument("name")
@click.option(
    "--dir",
    "target_dir",
    type=click.Path(),
    default=None,
    help="Target directory (defaults to ./<slugified-name>).",
)
@click.option("--dataset", default="", help="Machine identifier (defaults to slugified name).")
@click.option("--mission", default="", help="One-line agent description.")
def scaffold(name: str, target_dir: str | None, dataset: str, mission: str):
    """Scaffold a multi-file ReportAgent project.

    Creates a complete agent directory with stubs for agent.py, tools.py,
    studio_run.py, SQL, templates, and prompts. Runs in Studio immediately.

    Example::

        openreporting scaffold "Partner Health" --dir ./agents/partner_health
    """
    import re
    from openreporting.scaffold import scaffold_multifile_agent

    if target_dir is None:
        target_dir = "./" + re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")

    click.echo()
    click.echo(f"  Scaffolding agent: {click.style(name, bold=True)}")

    output_path = scaffold_multifile_agent(
        name=name,
        dataset_name=dataset,
        mission=mission,
        output_dir=target_dir,
    )

    click.echo(click.style("  Done!", fg="green", bold=True))
    click.echo()
    click.echo(f"  Created: {output_path}/")
    click.echo()
    click.echo("  Next steps:")
    click.echo("    1. Define your Pydantic payload model in tools.py")
    click.echo("    2. Implement build_report() with your SQL queries")
    click.echo("    3. Fill in template blocks in templates/report.html.j2")
    click.echo(f"    4. openreporting studio --dir {target_dir}")
    click.echo()


# ---------------------------------------------------------------------------
# studio
# ---------------------------------------------------------------------------


@cli.command()
@click.option(
    "--dir",
    "agents_dir",
    default=".",
    show_default=True,
    help="Directory to scan for agents.",
)
@click.option("--port", default=5999, show_default=True, help="Port to listen on.")
@click.option(
    "--api-key",
    envvar="OPENREPORTING_API_KEY",
    default=None,
    help="Open Reporting API key for publishing.",
)
def studio(agents_dir: str, port: int, api_key: str):
    """Start the local agent workbench."""
    try:
        import uvicorn
        from openreporting.studio.server import create_app
    except ImportError:
        raise click.ClickException(
            "Studio extras not installed. Run: pip install openreporting[studio]"
        )

    import threading
    import webbrowser

    app = create_app(agents_dir=agents_dir, api_key=api_key)
    threading.Timer(0.5, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    click.echo(f"  Studio running at http://localhost:{port}  (Ctrl+C to stop)")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
