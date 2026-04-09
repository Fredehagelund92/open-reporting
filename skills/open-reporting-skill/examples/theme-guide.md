# Theme Selection Guide

## At a Glance

| Theme | Personality | Density | Font | Slideshow Fit |
|-------|------------|---------|------|---------------|
| `executive` | Refined, spacious | spacious | Sans-serif (Inter) | Best — breathing room prevents crowding |
| `consulting` | Structured, polished | standard | Sans-serif (Inter) | Great — professional, balanced density |
| `default` | Clean, neutral | standard | Sans-serif (Inter) | Good — safe general-purpose choice |
| `editorial` | Readable, magazine | spacious | Serif (Georgia) | Good — strong for narrative-heavy decks |
| `dark` | Modern, screen-first | standard | Sans-serif (Inter) | Good — analytics on screens/projectors |
| `financial` | Data-dense, tabular | compact | Monospace | Acceptable — compact may crowd slides |
| `technical` | Code-friendly, minimal | compact | Monospace (JetBrains) | Acceptable — monospace unusual for decks |

## Slideshow Recommendations

**Best choices for slideshows**, in order:

1. **`executive`** — Spacious density with large headings (1.5x scale) gives slides room to breathe. 200px KPI cards look substantial. Best for board decks, leadership updates, quarterly reviews.

2. **`consulting`** — Standard density with a professional blue accent. Clean structure that works across audiences. Best for client-facing decks, strategy presentations, market analysis.

3. **`default`** — The safe pick. Standard density, neutral palette, no strong personality. Good when you don't know the audience or want the content to speak for itself.

4. **`editorial`** — Serif fonts (Georgia) and spacious density create a magazine feel. Excellent readability for text-heavy slides. Best for research presentations, thought leadership, industry analysis.

5. **`dark`** — All three slide roles use dark backgrounds. Great for projected content, monitoring dashboards, and analytics reviews where charts are the focus. Avoid for printed materials.

6. **`financial`** — Compact density packs more data but risks crowding slides. Monospace numbers align well in tables. Use only when the audience expects Bloomberg-terminal density. Works better for reports than slideshows.

7. **`technical`** — Compact density with monospace fonts. Works for engineering reviews and post-mortems where code snippets matter. Not ideal for non-technical audiences.

## Theme + Layout Combinations

| Use case | Theme | Layout | Why |
|----------|-------|--------|-----|
| Board deck | `executive` | `standard` | Spacious density + 960px gives authoritative, readable slides |
| Strategy presentation | `consulting` | `standard` | Professional, balanced — works for any audience |
| Analytics review | `dark` | `wide` | Dark background + 1200px fits large charts side-by-side |
| Earnings / financial | `financial` | `standard` | Compact density + monospace numbers for data-heavy slides |
| Research presentation | `editorial` | `standard` | Serif readability + spacious density for narrative content |
| Engineering review | `technical` | `standard` | Monospace for code references, compact for dense data |
| General purpose | `default` | `standard` | No wrong answer — safe for any content type |

## Slide Color Palettes by Theme

Each theme auto-assigns backgrounds to three slide roles: **title** (first slide), **content** (middle slides), and **closing** (last slide with action-items or key-takeaway).

| Theme | Title Slide | Content Slides | Closing Slide |
|-------|------------|----------------|---------------|
| `default` | Dark navy (`#1e293b`) with white text | White (`#ffffff`) with dark text | Light gray (`#f8fafc`) with dark text |
| `executive` | Deep navy (`#0f172a`) with white text | White (`#ffffff`) with dark text | Soft gray (`#f1f5f9`) with dark text |
| `consulting` | Deep navy (`#0f172a`) with white text | White (`#ffffff`) with dark text | Pale green (`#f0fdf4`) with dark text |
| `financial` | Steel blue (`#1e3a5f`) with light text | White (`#ffffff`) with dark text | Light gray (`#f8fafc`) with dark text |
| `technical` | Near-black (`#18181b`) with white text | White (`#ffffff`) with dark text | Off-white (`#fafafa`) with dark text |
| `editorial` | Warm black (`#1c1917`) with cream text | Warm white (`#fffbf5`) with dark text | Cream (`#fef3c7`) with dark text |
| `dark` | Near-black (`#020617`) with light text | Dark navy (`#0f172a`) with light text | Slate (`#1e293b`) with light text |

**Note:** You never set slide colors manually. Pick a theme and the renderer handles the rest. The `dark` theme is unique — all three roles use dark backgrounds with light text.
