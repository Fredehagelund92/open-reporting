"""Tests for openreporting scaffold multi-file agent generation."""
from __future__ import annotations

import os
from pathlib import Path


def test_scaffold_multifile_creates_all_files(tmp_path):
    from openreporting.scaffold import scaffold_multifile_agent

    output_dir = tmp_path / "my_agent"
    scaffold_multifile_agent(
        name="My Agent",
        dataset_name="my-agent",
        mission="Test mission.",
        output_dir=str(output_dir),
    )

    expected_files = [
        "__init__.py",
        "agent.py",
        "studio_run.py",
        "tools.py",
        "sql/.gitkeep",
        "templates/report.html.j2",
        "prompts/.gitkeep",
        "descriptions/.gitkeep",
    ]
    for f in expected_files:
        assert (output_dir / f).exists(), f"Missing: {f}"


def test_scaffold_multifile_agent_py_contains_class(tmp_path):
    from openreporting.scaffold import scaffold_multifile_agent

    output_dir = tmp_path / "test_agent"
    scaffold_multifile_agent(
        name="Test Agent",
        dataset_name="test-agent",
        mission="A test.",
        output_dir=str(output_dir),
    )

    agent_code = (output_dir / "agent.py").read_text()
    assert "class TestAgentAgent(ReportAgent):" in agent_code or "class TestAgent(ReportAgent):" in agent_code
    assert 'dataset_name = "test-agent"' in agent_code
    assert "build_data" in agent_code
    assert "snapshot_key" in agent_code


def test_scaffold_multifile_studio_run_contains_make_run(tmp_path):
    from openreporting.scaffold import scaffold_multifile_agent

    output_dir = tmp_path / "test_agent"
    scaffold_multifile_agent(
        name="Test Agent",
        dataset_name="test-agent",
        mission="A test.",
        output_dir=str(output_dir),
    )

    studio_code = (output_dir / "studio_run.py").read_text()
    assert "make_run" in studio_code
    assert 'STUDIO_NAME = "Test Agent"' in studio_code


def test_scaffold_multifile_template_extends_base(tmp_path):
    from openreporting.scaffold import scaffold_multifile_agent

    output_dir = tmp_path / "test_agent"
    scaffold_multifile_agent(
        name="Test Agent",
        dataset_name="test-agent",
        mission="A test.",
        output_dir=str(output_dir),
    )

    template = (output_dir / "templates" / "report.html.j2").read_text()
    assert 'extends "base_report.html.j2"' in template


def test_scaffold_cli_command(tmp_path):
    """Test the CLI command works end-to-end."""
    from click.testing import CliRunner
    from openreporting.cli import cli

    runner = CliRunner()
    target = str(tmp_path / "cli_agent")
    result = runner.invoke(cli, ["scaffold", "CLI Agent", "--dir", target])

    assert result.exit_code == 0, result.output
    assert (Path(target) / "agent.py").exists()
    assert (Path(target) / "studio_run.py").exists()
