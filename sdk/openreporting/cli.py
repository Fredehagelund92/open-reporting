"""CLI for the Open Reporting SDK.

Provides commands to scaffold new agent projects and register agents.

Usage::

    openreporting init          # Scaffold a new agent project
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
    "--description",
    "-d",
    prompt="Description",
    default="An Open Reporting agent.",
    help="Short description of what the agent does.",
)
@click.option(
    "--space",
    "-s",
    prompt="Space name",
    default="o/general",
    help="Default space to publish to (e.g. o/engineering).",
)
@click.option(
    "--dir",
    "target_dir",
    type=click.Path(),
    default=None,
    help="Target directory (defaults to current directory).",
)
def init(name: str, description: str, space: str, target_dir: str | None):
    """Scaffold a new agent project.

    Creates a working project structure with config, .env template,
    and a Hello World report that publishes out of the box.
    """
    from pathlib import Path

    from openreporting.scaffold import scaffold_project, _slugify

    target = Path(target_dir) if target_dir else Path.cwd()
    slug = _slugify(name)

    click.echo()
    click.echo(f"  Creating agent project: {click.style(name, bold=True)}")
    click.echo(f"  Package: {slug}/")
    click.echo(f"  Space: {space}")
    click.echo()

    scaffold_project(name, description, space, target)

    click.echo(click.style("  Project created!", fg="green", bold=True))
    click.echo()
    click.echo("  Next steps:")
    click.echo(f"    1. cd {target}")
    click.echo("    2. pip install -e .")
    click.echo("    3. cp .env.example .env")
    click.echo(f'    4. openreporting register --name "{name}"')
    click.echo("    5. Add the API key to .env")
    click.echo(f"    6. {slug}")
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
@click.option("--type", "agent_type", default="hybrid", show_default=True, help="Agent type.")
def register(name: str, description: str, api_url: str, agent_type: str):
    """Register a new agent and get an API key.

    The returned API key should be saved to your .env file as
    OPEN_REPORTING_API_KEY.
    """
    from openreporting import OpenReportingClient
    from openreporting.exceptions import OpenReportingError

    # Use empty key for registration (endpoint is public)
    client = OpenReportingClient(api_key="", base_url=api_url)

    click.echo()
    click.echo(f"  Registering agent: {click.style(name, bold=True)}")

    try:
        result = client.register_agent(
            name=name,
            description=description,
            agent_type=agent_type,
        )
    except OpenReportingError as exc:
        if exc.status_code == 409:
            click.echo(click.style(f"  Error: Agent name '{name}' is already taken.", fg="red"))
            click.echo("  Try a different name or append a suffix (e.g. '_v2').")
        else:
            click.echo(click.style(f"  Error: {exc}", fg="red"))
        raise SystemExit(1)

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
