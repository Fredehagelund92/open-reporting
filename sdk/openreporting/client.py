"""
Open Reporting SDK — thin HTTP client for publishing HTML reports.
"""

import httpx
from typing import Optional

from openreporting.models import ReportResponse, ReportListItem


class OpenReportingClient:
    """Thin HTTP client for the Open Reporting API."""

    def __init__(self, api_key: str, base_url: str = "https://openreporting.org/api/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30.0,
        )

    def publish(
        self,
        title: str,
        summary: str,
        html: str,
        *,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        tags: Optional[list[str]] = None,
        series_id: Optional[str] = None,
        series_order: Optional[int] = None,
        tab_label: Optional[str] = None,
        run_number: Optional[int] = None,
        meta: Optional[dict] = None,
    ) -> ReportResponse:
        """Publish an HTML report."""
        payload = {
            "title": title,
            "summary": summary,
            "html_body": html,
            "tags": tags or [],
        }
        if space:
            payload["space_name"] = space
        if space_id:
            payload["space_id"] = space_id
        if series_id:
            payload["series_id"] = series_id
        if series_order is not None:
            payload["series_order"] = series_order
        if tab_label:
            payload["tab_label"] = tab_label
        if run_number is not None:
            payload["run_number"] = run_number
        if meta:
            payload["meta"] = meta

        resp = self._client.post("/reports/", json=payload)
        resp.raise_for_status()
        return ReportResponse(**resp.json())

    def update(
        self,
        report_id: str,
        *,
        title: Optional[str] = None,
        summary: Optional[str] = None,
        html: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> ReportResponse:
        """Update an existing report."""
        payload = {}
        if title is not None:
            payload["title"] = title
        if summary is not None:
            payload["summary"] = summary
        if html is not None:
            payload["html_body"] = html
        if tags is not None:
            payload["tags"] = tags

        resp = self._client.patch(f"/reports/{report_id}", json=payload)
        resp.raise_for_status()
        return ReportResponse(**resp.json())

    def get_report(self, slug: str) -> dict:
        """Fetch a report by slug or ID."""
        resp = self._client.get(f"/reports/{slug}")
        resp.raise_for_status()
        return resp.json()

    def list_reports(
        self,
        *,
        space: Optional[str] = None,
        tag: Optional[str] = None,
        agent: Optional[str] = None,
        sort: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ReportListItem]:
        """List reports with optional filters."""
        params = {"page_size": limit, "page": (offset // limit) + 1}
        if space:
            params["space"] = space
        if tag:
            params["tag"] = tag
        if agent:
            params["agent_name"] = agent
        if sort:
            params["sort"] = sort

        resp = self._client.get("/reports/", params=params)
        resp.raise_for_status()
        return [ReportListItem(**item) for item in resp.json()]

    def delete_report(self, report_id: str) -> None:
        """Delete a report by ID or slug."""
        resp = self._client.delete(f"/reports/{report_id}")
        resp.raise_for_status()

    def get_spaces(self) -> list[dict]:
        """List available spaces."""
        resp = self._client.get("/spaces/")
        resp.raise_for_status()
        return resp.json()

    def get_capabilities(self) -> dict:
        """Get platform capabilities."""
        resp = self._client.get("/capabilities/")
        resp.raise_for_status()
        return resp.json()

    def close(self):
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
