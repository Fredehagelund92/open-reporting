"""Showcase endpoint — renders all report builder examples in one request."""

from __future__ import annotations

from functools import lru_cache
import json as _json

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.renderers import render_structured_to_html

router = APIRouter(prefix="/api/v1/showcase", tags=["Showcase"])

# ---------------------------------------------------------------------------
# Canonical examples (keyed by ID, mirrored from frontend ShowcasePage)
# ---------------------------------------------------------------------------

EXAMPLES: list[tuple[str, list[dict]]] = [
    # --- Section types ---
    ("summary-header", [{
        "type": "summary-header",
        "title": "Weekly Business Review",
        "subtitle": "Week of March 24 – March 30, 2025",
        "date": "2025-03-30",
        "stats": [
            {"label": "Revenue", "value": "$2.87M"},
            {"label": "Growth", "value": "+4.2%"},
            {"label": "Net New ARR", "value": "$142K"},
            {"label": "Churn", "value": "1.8%"},
        ],
    }]),
    ("text", [{
        "type": "text",
        "heading": "Executive Summary",
        "body": "Revenue grew **4.2% WoW** to $2.87M, driven by Enterprise expansion. Net new ARR of $142K beat the $120K target.\n\n- Pipeline coverage improved to **3.4x** (target: 3.0x)\n- Customer health score rose to **82/100** (+3 points)\n- Two Enterprise deals ($380K) slipped to Q2 — churn ticked up 0.3pp",
    }]),
    ("kpi-grid", [{
        "type": "kpi-grid",
        "metrics": [
            {"label": "Revenue", "value": "$2.87M", "delta": "+4.2%", "trend": "up"},
            {"label": "Net New ARR", "value": "$142K", "delta": "+$22K", "trend": "up"},
            {"label": "Churn Rate", "value": "1.8%", "delta": "+0.3pp", "trend": "down"},
            {"label": "Pipeline Coverage", "value": "3.4x", "delta": "+0.4x", "trend": "up"},
        ],
    }]),
    ("table", [{
        "type": "table",
        "heading": "Deal Pipeline",
        "headers": ["Account", "Stage", "Value", "Close Date", "Owner"],
        "rows": [
            ["Acme Corp", "Negotiation", "$120K", "Apr 15", "Sarah Chen"],
            ["TechStart Inc", "Proposal", "$85K", "Apr 22", "Mike Torres"],
            ["GlobalFin", "Discovery", "$340K", "May 10", "Sarah Chen"],
            ["DataFlow Ltd", "Closed Won", "$95K", "Mar 28", "Raj Patel"],
        ],
        "caption": "Enterprise pipeline as of March 30, 2025",
    }]),
    ("callout", [
        {"type": "callout", "callout_type": "info", "message": "Board meeting moved to April 3rd. Updated deck due by EOD April 1st."},
        {"type": "callout", "callout_type": "warning", "message": "Two Enterprise deals ($380K combined) slipped to Q2. Finance team notified."},
        {"type": "callout", "callout_type": "success", "message": "Analytics add-on GA released on schedule — highest-priority Q1 deliverable shipped."},
        {"type": "callout", "callout_type": "error", "message": "Payment processing outage (SEV-1) lasted 47 minutes, impacting 2,340 customers."},
    ]),
    ("quote", [{
        "type": "quote",
        "text": "The analytics add-on is exactly what our enterprise customers have been asking for. Three prospects specifically cited it as a differentiator in their evaluation.",
        "attribution": "VP Sales, Q1 Pipeline Review",
    }]),
    ("key-takeaway", [{
        "type": "key-takeaway",
        "heading": "Key Takeaway",
        "message": "Revenue momentum is strong (+4.2% WoW) but Q2 churn risk from slipped Enterprise deals needs immediate attention. Recommend allocating 20% of April capacity to retention outreach.",
    }]),
    ("stat-highlight", [{
        "type": "stat-highlight",
        "value": "$2.87M",
        "label": "Weekly Revenue",
        "context": "Highest weekly revenue since Q3 2024, driven by Enterprise expansion deals closing ahead of schedule.",
        "delta": "+4.2%",
        "trend": "up",
    }]),
    ("two-column", [{
        "type": "two-column",
        "left": {
            "heading": "What Went Well",
            "body": "- Revenue beat target by **18%**\n- Analytics GA shipped on schedule\n- Pipeline coverage at 3.4x\n- Zero SEV-1 incidents this week",
        },
        "right": {
            "heading": "Areas for Improvement",
            "body": "- Two Enterprise deals slipped to Q2\n- Churn rate ticked up 0.3pp\n- Marketing MQL conversion dropped 5%\n- Onboarding NPS below 70",
        },
    }]),
    ("timeline", [{
        "type": "timeline",
        "heading": "Incident Timeline",
        "events": [
            {"date": "14:23 UTC", "title": "Alerts triggered", "description": "PagerDuty alerts fired for payment processing latency >5s."},
            {"date": "14:26 UTC", "title": "On-call engaged", "description": "SRE on-call acknowledged. Initial triage began."},
            {"date": "14:35 UTC", "title": "Root cause identified", "description": "DB connection pool exhausted — misconfigured limit in v4.12.3."},
            {"date": "15:02 UTC", "title": "Fix deployed", "description": "Connection pool limit increased. Canary deployment started."},
            {"date": "15:10 UTC", "title": "Service restored", "description": "All payment endpoints healthy. Customer impact ended."},
        ],
    }]),
    ("action-items", [{
        "type": "action-items",
        "heading": "Next Steps",
        "items": [
            {"action": "Schedule retention calls for at-risk accounts", "owner": "Sarah Chen", "due": "Apr 3", "impact": "Reduce Q2 churn risk"},
            {"action": "Finalize Q2 pricing tier proposal", "owner": "Product Team", "due": "Apr 7", "impact": "Enable growth pricing"},
            {"action": "Complete post-incident review for INC-2025-0219", "owner": "SRE Team", "due": "Apr 1", "impact": "Prevent recurrence"},
        ],
    }]),
    ("columns", [{
        "type": "columns",
        "columns": [
            {"sections": [
                {"type": "text", "heading": "Revenue", "body": "Weekly revenue reached **$2.87M**, up 4.2% WoW. Enterprise segment drove most of the growth with three new deals closing."},
            ]},
            {"sections": [
                {"type": "text", "heading": "Pipeline", "body": "Coverage improved to **3.4x** (target: 3.0x). Twelve new opportunities entered discovery this week."},
            ]},
            {"sections": [
                {"type": "text", "heading": "Retention", "body": "Churn ticked up to **1.8%** (+0.3pp) after two Enterprise deals slipped to Q2."},
            ]},
        ],
    }]),
    ("columns-2", [{
        "type": "columns",
        "columns": [
            {"sections": [
                {"type": "text", "heading": "Key Findings", "body": "Revenue grew **4.2% WoW** to $2.87M.\n\n- Pipeline at 3.4x coverage\n- Net new ARR beat target by 18%\n- Two deals slipped to Q2"},
                {"type": "callout", "callout_type": "warning", "message": "Enterprise churn risk: $380K in slipped deals needs immediate attention."},
            ]},
            {"sections": [{
                "type": "chart", "chart_type": "bar", "heading": "Revenue by Region",
                "data": {"labels": ["NAM", "EMEA", "APAC"], "datasets": [{"name": "Revenue ($K)", "values": [1420, 890, 560]}]},
            }]},
        ],
    }]),
    ("divider", [{"type": "divider"}, {"type": "divider", "label": "Section Break"}]),
    ("spacer", [{"type": "spacer", "height": "40px"}]),
    # --- Chart types ---
    ("bar-chart", [{
        "type": "chart", "chart_type": "bar", "heading": "Revenue by Region",
        "data": {"labels": ["North America", "EMEA", "APAC", "LATAM"], "datasets": [
            {"name": "Q1 Actual", "values": [1420, 890, 560, 210]},
            {"name": "Q1 Target", "values": [1300, 950, 500, 250]},
        ]},
    }]),
    ("line-chart", [{
        "type": "chart", "chart_type": "line", "heading": "Weekly Active Users",
        "data": {"labels": ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"], "datasets": [
            {"name": "WAU", "values": [12400, 13100, 12800, 14200, 15100, 14800, 16300, 17200]},
        ]},
    }]),
    ("area-chart", [{
        "type": "chart", "chart_type": "area", "heading": "Monthly Recurring Revenue",
        "data": {"labels": ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"], "datasets": [
            {"name": "MRR", "values": [5800, 6100, 6400, 6900, 7200, 7600]},
        ]},
    }]),
    ("pie-chart", [{
        "type": "chart", "chart_type": "pie", "heading": "Revenue by Segment",
        "data": {"segments": [
            {"label": "Enterprise", "value": 1420},
            {"label": "Mid-Market", "value": 890},
            {"label": "SMB", "value": 560},
        ]},
    }]),
    ("donut-chart", [{
        "type": "chart", "chart_type": "donut", "heading": "Support Tickets by Category",
        "data": {"segments": [
            {"label": "Billing", "value": 142},
            {"label": "Technical", "value": 89},
            {"label": "Onboarding", "value": 56},
            {"label": "Feature Request", "value": 34},
        ], "center_label": "321 total"},
    }]),
    ("horizontal-bar-chart", [{
        "type": "chart", "chart_type": "horizontal-bar", "heading": "Top Performing Reps",
        "data": {"labels": ["Sarah Chen", "Mike Torres", "Raj Patel", "Lisa Kim", "James Wu"], "datasets": [
            {"name": "Q1 Revenue ($K)", "values": [420, 380, 310, 290, 270]},
        ]},
    }]),
    ("stacked-bar-chart", [{
        "type": "chart", "chart_type": "stacked-bar", "heading": "Pipeline by Stage",
        "data": {"labels": ["Jan", "Feb", "Mar", "Apr"], "datasets": [
            {"name": "Discovery", "values": [200, 180, 220, 240]},
            {"name": "Proposal", "values": [150, 170, 160, 190]},
            {"name": "Negotiation", "values": [80, 90, 110, 130]},
        ]},
    }]),
    ("heatmap-chart", [{
        "type": "chart", "chart_type": "heatmap", "heading": "Pipeline Health by Region × Stage",
        "data": {
            "x_labels": ["Discovery", "Proposal", "Negotiation", "Closed"],
            "y_labels": ["North America", "EMEA", "APAC"],
            "values": [[12, 8, 4, 2], [9, 6, 3, 1], [6, 4, 2, 1]],
            "scale": "sequential",
        },
    }]),
]

THEME_SAMPLE: list[dict] = [
    {"type": "summary-header", "title": "Revenue Operations Report", "subtitle": "March 2025", "stats": [
        {"label": "Revenue", "value": "$2.87M"}, {"label": "Growth", "value": "+4.2%"},
    ]},
    {"type": "kpi-grid", "metrics": [
        {"label": "Net New ARR", "value": "$142K", "delta": "+18%", "trend": "up"},
        {"label": "Churn Rate", "value": "1.8%", "delta": "+0.3pp", "trend": "down"},
        {"label": "Pipeline", "value": "3.4x", "delta": "+0.4x", "trend": "up"},
    ]},
    {"type": "chart", "chart_type": "bar", "heading": "Revenue by Quarter",
     "data": {"labels": ["Q1", "Q2", "Q3", "Q4"], "datasets": [{"name": "Revenue ($M)", "values": [2.1, 2.4, 2.6, 2.87]}]}},
    {"type": "callout", "callout_type": "info", "message": "Board review scheduled for April 3rd."},
]

# ---------------------------------------------------------------------------
# Cached renderer
# ---------------------------------------------------------------------------

def _normalize_sections(sections: list[dict]) -> list[dict]:
    """Normalize shorthand chart format: {type:"chart", chart_type:"bar"} → {type:"bar-chart"}.
    Also normalizes dataset {label:...} → {name:...} for chart validation."""
    out = []
    for s in sections:
        s = dict(s)
        if s.get("type") == "chart" and "chart_type" in s:
            ct = s.pop("chart_type")
            s["type"] = f"{ct}-chart" if not ct.endswith("-chart") else ct
        # Normalize dataset label → name
        data = s.get("data")
        if isinstance(data, dict) and "datasets" in data:
            s["data"] = {**data, "datasets": [
                {**ds, "name": ds.pop("label")} if "label" in ds and "name" not in ds else ds
                for ds in data["datasets"]
            ]}
        # Recurse into columns
        if s.get("type") == "columns" and "columns" in s:
            s["columns"] = [
                {**col, "sections": _normalize_sections(col.get("sections", []))}
                for col in s["columns"]
            ]
        out.append(s)
    return out


@lru_cache(maxsize=256)
def _render_cached(sections_json: str, theme: str) -> str:
    sections = _normalize_sections(_json.loads(sections_json))
    return render_structured_to_html(sections, theme=theme)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

class ShowcaseResponse(BaseModel):
    theme: str
    previews: dict[str, str]


@router.get("/previews", response_model=ShowcaseResponse)
def get_showcase_previews(theme: str = Query(default="default")):
    """Render all showcase examples in one request."""
    previews: dict[str, str] = {}

    for example_id, sections in EXAMPLES:
        previews[example_id] = _render_cached(_json.dumps(sections), theme)

    previews["__theme_sample"] = _render_cached(_json.dumps(THEME_SAMPLE), theme)

    return ShowcaseResponse(theme=theme, previews=previews)
