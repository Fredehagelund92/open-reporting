# Slide Type: Chart Slide

## When to use

When presenting a data visualization. One chart per slide — never stack two charts. Always pair with a callout or short text that explains the key takeaway.

## DO (Good Pattern)

One chart with a descriptive heading, correct type for the data shape, and a callout explaining the insight.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "bar-chart",
      "heading": "Market Share by Competitor (Q1 2025)",
      "labels": ["Acme", "Zenith", "Omega", "Us"],
      "datasets": [
        {"name": "Market Share %", "values": [28, 22, 18, 32]}
      ]
    },
    {
      "type": "callout",
      "callout_type": "info",
      "message": "Market leadership maintained at 32%, widening the gap over Acme by 4 points. Omega's share declined 3pp as they restructured their sales team."
    }
  ]
}
```

## DON'T (Bad Pattern)

Two charts stacked on one slide, no headings, wrong chart type (bar for time series), and no callout.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "bar-chart",
      "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      "datasets": [
        {"name": "Revenue", "values": [10, 12, 11, 14, 15, 18]}
      ]
    },
    {
      "type": "pie-chart",
      "heading": "Breakdown",
      "segments": [
        {"label": "A", "value": 10},
        {"label": "B", "value": 8},
        {"label": "C", "value": 6},
        {"label": "D", "value": 5},
        {"label": "E", "value": 4},
        {"label": "F", "value": 3},
        {"label": "G", "value": 2},
        {"label": "H", "value": 1}
      ]
    }
  ]
}
```

**What's wrong:**
- Two charts on one slide — each chart deserves its own slide
- Bar chart missing `heading` — viewers don't know what they're looking at
- Bar chart used for time-series (Jan-Jun) — should be `line-chart` or `area-chart`
- Pie chart has 8 segments — max 6, consolidate small ones into "Other"
- Pie heading "Breakdown" is vague — heading should describe what's being broken down
- No callout on either chart — every chart needs context

## Chart Type Selection

| Data shape | Use | Not |
|-----------|-----|-----|
| Trend over time | `line-chart` or `area-chart` | `bar-chart` |
| Category comparison | `bar-chart` | `line-chart` |
| Ranking (5+ categories) | `horizontal-bar-chart` | `bar-chart` |
| Part of whole | `pie-chart` (max 6 segments) or `donut-chart` | `bar-chart` |
| Multiple datasets over time | `stacked-bar-chart` or `area-chart` | Multiple `pie-chart` |

## Rules

- One chart per slide — always
- Every chart must have a `heading` that describes the data and time period
- Always pair with a `callout` stating the key takeaway (never chart alone)
- Use the correct chart type for the data shape (see table above)
- Pie/donut charts: max 6 segments — consolidate small ones into "Other"
- All values must be plain numbers (no `$`, `%`, commas in values array)
- `labels` array length must exactly match `values` array length in every dataset
