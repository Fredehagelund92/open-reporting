# Slide Type: Comparison / Two-Column Slide

## When to use

When comparing two alternatives, strategies, time periods, or entities side by side. Use `columns` to place two text blocks next to each other instead of stacking them vertically.

## DO (Good Pattern)

Two balanced columns with headings, comparable structure, and concise bullet points.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "columns",
      "columns": [
        [
          {
            "type": "text",
            "heading": "Acme Corp",
            "body": "- Revenue: $890M (+6% YoY)\n- Focus: Enterprise SaaS\n- Strength: Brand recognition, 40% market awareness\n- Risk: Slow product iteration, 18-month release cycles"
          }
        ],
        [
          {
            "type": "text",
            "heading": "Zenith Inc",
            "body": "- Revenue: $620M (+14% YoY)\n- Focus: Mid-market + self-serve\n- Strength: Rapid growth, NPS 78 vs industry avg 52\n- Risk: Negative margins, -8% EBITDA"
          }
        ]
      ]
    }
  ]
}
```

## DON'T (Bad Pattern)

Two text sections stacked vertically, asymmetric content, no headings, no numbers.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "text",
      "body": "Acme Corp is a large enterprise software company that has been in the market for a long time. They have a strong brand and are well known in the industry. Their products are widely used by Fortune 500 companies."
    },
    {
      "type": "text",
      "body": "Zenith is growing fast."
    }
  ]
}
```

**What's wrong:**
- Two `text` sections stacked vertically — use `columns` for side-by-side comparison
- No headings on either section — unclear what's being compared
- First section is 250+ characters (overflow risk), second is 25 characters — wildly asymmetric
- No numbers or data — just vague descriptions
- Filler language ("has been in the market for a long time", "widely used")
- Stacking triggers `slide_too_thin` if separated, or `slide_content_overflow` if dense

## Rules

- Use `columns` section type for side-by-side comparisons — never stack two `text` sections
- Both columns should have headings
- Keep columns roughly balanced in length (within 50% of each other)
- Use parallel structure — if one column lists Revenue, Focus, Strength, Risk, the other should too
- Include numbers in every bullet point
- Each column's text should stay under 200 characters
