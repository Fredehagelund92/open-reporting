# Slide Type: Title Slide

## When to use

The first slide of every slideshow. Sets the context with a `summary-header` section containing a title, subtitle, date, and 2-3 stats badges.

## DO (Good Pattern)

Title is specific and scannable. Subtitle identifies the team or scope. Stats give immediate context with real numbers.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "summary-header",
      "title": "Q1 2025 Revenue Performance",
      "subtitle": "North America Sales Division",
      "date": "March 2025",
      "stats": [
        {"label": "Revenue", "value": "$142M"},
        {"label": "YoY Growth", "value": "+18%"},
        {"label": "Win Rate", "value": "34%"}
      ]
    }
  ]
}
```

## DON'T (Bad Pattern)

Title is vague. No subtitle or date. Stats use text instead of numbers.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "summary-header",
      "title": "Sales Update"
    }
  ]
}
```

**What's wrong:**
- Title "Sales Update" could mean anything — no time period, no scope
- Missing subtitle — viewers don't know which team or division
- Missing date — no temporal context
- Missing stats — wasted space on the most prominent slide

## Rules

- Title under 60 characters — must be scannable
- Always include subtitle (team, department, or scope)
- Always include date (month, quarter, or date range)
- Include 2-3 stats with real numbers — these are the first data points viewers see
- Stat values must be short numbers, not sentences
- The theme auto-assigns a dark background to title slides — do not set `background_color`
