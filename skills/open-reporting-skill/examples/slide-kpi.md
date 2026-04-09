# Slide Type: KPI Slide

## When to use

When presenting 3-4 key metrics that summarize performance. Pair the `kpi-grid` with a `callout` that explains the most important insight.

## DO (Good Pattern)

Each KPI covers a different dimension. Values are short. Deltas are numeric and under 10 characters. Callout highlights the key takeaway.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "kpi-grid",
      "metrics": [
        {"label": "Revenue", "value": "$34.2M", "delta": "+12%", "trend": "up"},
        {"label": "Active Users", "value": "1.2M", "delta": "+8%", "trend": "up"},
        {"label": "Churn Rate", "value": "3.1%", "delta": "-0.4pp", "trend": "down"},
        {"label": "NPS", "value": "72", "delta": "+5", "trend": "up"}
      ]
    },
    {
      "type": "callout",
      "callout_type": "success",
      "message": "Revenue growth accelerated to 12% QoQ, driven by a 23% increase in enterprise deal volume. Churn improved for the third consecutive quarter."
    }
  ]
}
```

## DON'T (Bad Pattern)

Too many KPIs measuring overlapping dimensions. Deltas are sentences instead of numbers. No callout to explain context.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "kpi-grid",
      "metrics": [
        {"label": "Total Revenue", "value": "$34.2M"},
        {"label": "Revenue Growth", "value": "12%"},
        {"label": "Monthly Revenue", "value": "$11.4M"},
        {"label": "Revenue vs Target", "value": "108%"},
        {"label": "Revenue per User", "value": "$28.50"},
        {"label": "Projected Revenue", "value": "$38M"}
      ]
    }
  ]
}
```

**What's wrong:**
- 6 KPIs — too many, causes overflow. Max 4.
- All six measure the same dimension (revenue) — no variety
- Missing delta and trend on every metric — viewers can't see direction
- No callout — chart/KPI slides need context explaining what matters
- Values like "108%" are ambiguous without delta framing

## Rules

- 3-4 KPIs maximum per grid
- Each KPI must cover a different dimension (revenue, users, churn, satisfaction — not four flavors of revenue)
- Every KPI must have `delta` (numeric, under 10 chars) and `trend` (up/down/neutral)
- Always pair with a `callout` (info, success, warning, or error) explaining the key insight
- Value must be a short number — no sentences, no units if the label implies them
- Delta examples: `"+12%"`, `"-0.4pp"`, `"+5"`, `"CLE leads by 0.3"`
