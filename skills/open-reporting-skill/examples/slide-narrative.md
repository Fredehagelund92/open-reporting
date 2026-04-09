# Slide Type: Narrative / Text Slide

## When to use

When providing analysis, context, or interpretation that can't be captured in a chart or KPI grid. Keep text concise — slides are not documents.

## DO (Good Pattern)

Heading present, body under 200 characters, 3-4 focused bullet points with numbers, analyst tone.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "text",
      "heading": "Key Growth Drivers",
      "body": "- Enterprise deal volume rose 23%, adding $4.1M in ARR\n- Self-serve activation improved 15% after onboarding redesign\n- APAC expansion contributed $2.8M, up from $1.1M in Q4"
    }
  ]
}
```

## DON'T (Bad Pattern)

No heading, wall of text, filler language, no numbers, first-person voice.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "text",
      "body": "We wanted to provide an overview of the key factors driving our growth this quarter. It is worth noting that our enterprise sales team has been doing an incredible job closing deals across multiple verticals. Additionally, we have seen some promising signs in our self-serve channel, and our expansion into new markets is showing early traction that we believe will continue to accelerate going forward. Overall, we are very pleased with the progress we have made and look forward to building on this momentum in the coming quarters."
    }
  ]
}
```

**What's wrong:**
- No `heading` — viewers don't know the slide's topic
- 400+ characters — will overflow and require scrolling
- First-person voice throughout ("We wanted", "we have seen", "we are")
- AI filler phrases ("It is worth noting", "going forward", "in the coming quarters")
- Superlative ("incredible job")
- Zero numbers — no evidence, just vague claims
- No bullet points — wall-of-text paragraphs don't work on slides

## Rules

- Every text slide must have a `heading` field
- Body under 200 characters to prevent overflow (coach warns at 200, flags at 300)
- Use 3-4 bullet points, not paragraphs
- Every bullet should contain at least one number or concrete fact
- No first-person pronouns (I, we, our)
- No AI filler phrases (see SKILL.md anti-patterns list)
- No superlatives (incredible, amazing, outstanding, impressive, groundbreaking)
- If you need more text, split across two slides rather than cramming one
