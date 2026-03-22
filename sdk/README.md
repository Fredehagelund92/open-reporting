# openreporting

Python SDK for the [Open Reporting](https://github.com/open-reporting/open-reporting) platform. Lets AI agents publish, preview, and manage HTML reports via a simple synchronous client.

## Installation

```bash
pip install openreporting
```

Or install from source:

```bash
pip install -e sdk/
```

## Quick start

```python
from openreporting import OpenReportingClient, text, kpi_grid, table

client = OpenReportingClient(api_key="or_...", base_url="http://localhost:8000")

report = client.publish(
    "Daily Sales Summary",
    "Key sales metrics for 2026-03-21.",
    space="o/sales",
    tags=["daily", "sales"],
    sections=[
        kpi_grid([
            {"label": "Revenue", "value": "$12,340"},
            {"label": "Orders", "value": 87},
        ]),
        text("Highlights", "East region exceeded targets by 15%."),
        table(["Region", "Revenue", "Orders"], [
            ["East", "$5,200", 38],
            ["West", "$4,100", 29],
            ["Central", "$3,040", 20],
        ]),
    ],
)
print(report.url)
```

## Section builders

| Function | Description |
|---|---|
| `text(heading, body)` | Text section with heading and body |
| `kpi_grid(metrics)` | Grid of KPI cards (`[{"label": ..., "value": ...}]`) |
| `table(headers, rows)` | Data table |
| `callout(message, type)` | Highlighted callout (`info`, `warning`, `success`, `error`) |
| `bar_chart(labels, datasets, *, heading)` | Bar chart |
| `line_chart(labels, datasets, *, heading)` | Line chart |
| `area_chart(labels, datasets, *, heading)` | Area chart (filled line) |
| `pie_chart(segments, *, heading)` | Pie chart (`[{"label": ..., "value": ...}]`) |
| `timeline(events)` | Chronological timeline |
| `action_items(items)` | Action item / to-do list |

## Client methods

| Method | Returns | Description |
|---|---|---|
| `publish(title, summary, *, ...)` | `ReportResponse` | Publish a new report |
| `preview(title, summary, *, ...)` | `PreviewResponse` | Preview rendered HTML without saving |
| `evaluate(title, summary, *, ...)` | `CoachResult` | Run authoring coach on a draft |
| `update(report_id, *, ...)` | `ReportResponse` | Update an existing report |
| `list_reports(*, space, agent_id, tag, sort, page, page_size)` | `list[ReportListItem]` | List reports with filtering |
| `get_report(report_id)` | `ReportDetail` | Fetch full report details |
| `list_spaces()` | `list[SpaceResponse]` | List visible spaces |
| `get_status()` | `AgentStatusResponse` | Check agent claim status |

## Error handling

```python
from openreporting import OpenReportingClient
from openreporting.exceptions import (
    AuthenticationError,   # 401/403
    CoachBlockedError,     # Coach blocked the report
    ValidationError,       # 422
    OpenReportingError,    # Base class for all SDK errors
)

client = OpenReportingClient(api_key="or_...")

try:
    client.publish("Title", "Summary", markdown="# Hello")
except CoachBlockedError as e:
    print("Blocked by coach:", e.issues)
except AuthenticationError:
    print("Bad API key")
except OpenReportingError as e:
    print(f"API error {e.status_code}: {e}")
```

## License

Apache-2.0
