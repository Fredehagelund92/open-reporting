"""Agent project scaffolding — generates a working agent project structure."""

from __future__ import annotations

import re
from pathlib import Path


def _slugify(name: str) -> str:
    """Convert 'My Cool Agent' to 'my_cool_agent' for a Python package name."""
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return slug or "my_agent"


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

_PYPROJECT = """\
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "{name}"
version = "0.1.0"
description = "{description}"
requires-python = ">=3.10"
dependencies = [
    "openreporting",
    "pydantic-settings>=2.0",
]

[project.scripts]
{slug} = "{slug}.agent:main"
"""

_ENV_EXAMPLE = """\
# Open Reporting configuration
OPEN_REPORTING_API_KEY=
OPEN_REPORTING_API_URL=http://localhost:8000
SPACE_NAME={space_name}
"""

_CONFIG = """\
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    open_reporting_api_key: str = ""
    open_reporting_api_url: str = "http://localhost:8000"
    space_name: str = "{space_name}"

    model_config = {{"env_file": ".env", "env_file_encoding": "utf-8"}}


settings = Settings()
"""

_AGENT = """\
\"\"\"Minimal Open Reporting agent — generates and publishes a report.\"\"\"

from openreporting import OpenReportingClient, text, kpi_grid, callout

from {slug}.config import settings


def _get_client() -> OpenReportingClient:
    return OpenReportingClient(
        api_key=settings.open_reporting_api_key,
        base_url=settings.open_reporting_api_url,
    )


def run():
    \"\"\"Generate and publish a report.\"\"\"
    client = _get_client()

    # Build a system prompt so the LLM knows all available section types,
    # charts, themes, and layouts (optional — for LLM-powered agents):
    # prompt = client.build_system_prompt()

    report = client.publish(
        title="Hello from {name}",
        summary="First report published by {name}.",
        sections=[
            text("Welcome", "This is your first report. Edit `agent.py` to customise."),
            kpi_grid([
                {{"label": "Status", "value": "Online", "delta": "New", "trend": "up"}},
            ]),
            callout("Edit this agent to pull real data and generate meaningful reports.", type="info"),
        ],
        space=settings.space_name,
        tags=["hello-world"],
        theme="default",
        layout="standard",
    )
    print(f"Published: {{report.slug}}")


def main():
    \"\"\"CLI entry point.\"\"\"
    import argparse
    parser = argparse.ArgumentParser(description="{name}")
    parser.add_argument("--dry-run", action="store_true", help="Preview without publishing")
    args = parser.parse_args()

    if args.dry_run:
        client = _get_client()
        result = client.dry_run(
            title="Hello from {name}",
            summary="Dry run test.",
            sections=[
                text("Welcome", "This is a dry run test."),
                kpi_grid([
                    {{"label": "Status", "value": "Testing", "delta": "dry-run", "trend": "up"}},
                ]),
            ],
            theme="default",
            open_browser=True,
        )
        if result.passed:
            print("Dry run passed — ready to publish!")
        else:
            print("Dry run found issues — fix them before publishing.")
    else:
        run()


if __name__ == "__main__":
    main()
"""

_INIT = """\
"""

_README = """\
# {name}

{description}

## Quick start

```bash
# Install dependencies
pip install -e .

# Configure
cp .env.example .env
# Edit .env and add your OPEN_REPORTING_API_KEY

# Register your agent (if you don't have a key yet)
openreporting register --name "{name}" --api-url http://localhost:8000

# Run
{slug}
```
"""


# ---------------------------------------------------------------------------
# Scaffolding
# ---------------------------------------------------------------------------


def scaffold_project(
    name: str,
    description: str,
    space_name: str,
    target_dir: Path | None = None,
) -> Path:
    """Generate a new agent project in *target_dir* (defaults to cwd).

    Returns the path to the created project directory.
    """
    slug = _slugify(name)
    root = (target_dir or Path.cwd())
    pkg = root / slug

    pkg.mkdir(parents=True, exist_ok=True)

    ctx = {"name": name, "description": description, "slug": slug, "space_name": space_name}

    files = {
        root / "pyproject.toml": _PYPROJECT.format(**ctx),
        root / ".env.example": _ENV_EXAMPLE.format(**ctx),
        root / "README.md": _README.format(**ctx),
        pkg / "__init__.py": _INIT,
        pkg / "config.py": _CONFIG.format(**ctx),
        pkg / "agent.py": _AGENT.format(**ctx),
    }

    for path, content in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    return root
