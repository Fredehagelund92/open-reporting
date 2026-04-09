# Slide Type: Closing Slide

## When to use

The final slide of a slideshow. Use `action-items` for next steps with clear owners and deadlines, or `key-takeaway` for a concluding insight. The theme auto-assigns an accent background to closing slides.

## DO (Good Pattern) — Action Items

3-4 specific action items, each with owner, due date, and impact level.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "action-items",
      "items": [
        {
          "text": "Finalize APAC pricing model for enterprise tier",
          "owner": "Sarah Chen",
          "due": "2025-04-15",
          "impact": "high"
        },
        {
          "text": "Launch onboarding A/B test for self-serve activation",
          "owner": "Product Team",
          "due": "2025-04-07",
          "impact": "medium"
        },
        {
          "text": "Schedule QBR with top 5 enterprise accounts",
          "owner": "Account Management",
          "due": "2025-04-10",
          "impact": "high"
        }
      ]
    }
  ]
}
```

## DO (Good Pattern) — Key Takeaway

A single, memorable conclusion that captures the presentation's core message.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "key-takeaway",
      "heading": "Bottom Line",
      "message": "Revenue growth accelerated to 18% YoY, but 62% of new ARR came from a single vertical. Diversifying the pipeline before Q3 is critical to sustaining this trajectory."
    }
  ]
}
```

## DON'T (Bad Pattern)

Vague actions, no owners, no due dates, too many items.

```json
{
  "type": "slide",
  "sections": [
    {
      "type": "action-items",
      "items": [
        {"text": "Follow up on sales opportunities"},
        {"text": "Continue monitoring market trends"},
        {"text": "Explore partnership options"},
        {"text": "Review team performance"},
        {"text": "Update stakeholders on progress"},
        {"text": "Plan for next quarter"},
        {"text": "Schedule follow-up meetings"}
      ]
    }
  ]
}
```

**What's wrong:**
- 7 action items — too many for one slide, max 3-4
- No `owner` on any item — nobody is accountable
- No `due` dates — no urgency or timeline
- No `impact` — can't prioritize
- Actions are vague ("Follow up on sales opportunities", "Continue monitoring") — should be specific and measurable

## Rules

- 3-4 action items maximum per slide
- Every item must have `owner` (person or team name) and `due` (ISO date or short date)
- Include `impact` (high/medium/low) to help viewers prioritize
- Actions must be specific and measurable — not "follow up" or "explore"
- For `key-takeaway`, keep the message under 200 characters with at least one concrete number
- The theme auto-assigns an accent background — do not set `background_color`
