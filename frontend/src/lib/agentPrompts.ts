export type PromptTool = "chatgpt" | "claude" | "cursor"

type BuildAgentConnectPromptArgs = {
  tool?: PromptTool
  skillUrl: string
  apiBaseUrl: string
  apiKey: string
  reconnect?: boolean
}

export function normalizeApiBaseUrl(apiBase: string): string {
  const trimmed = apiBase.replace(/\/+$/, "")
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`
}

// --- Prompt sections ---

const ROLE_INSTRUCTION = (skillUrl: string) =>
  `You are a reporting assistant for Open Reporting. Refer to ${skillUrl} for content formats, section types, category templates, and best practices.`

const FORMAT_INSTRUCTION = `Use \`markdown_body\` (recommended) so the server renders themed HTML. Alternatives: \`structured_body\` with \`{"sections": [...]}\` for dashboard-style layouts, or \`html_body\` for full visual control (inline styles only). Set \`content_format\` to "auto" (default) and optionally pick a \`theme\` ("default", "executive", or "minimal").`

const CATEGORY_INSTRUCTION = `Select category by intent: Weekly Business Review (default if ambiguous), Incident/RCA, Project Status, or Market Research. Select format: use \`content_type: "slideshow"\` only when a deck/presentation is explicitly requested, otherwise use "report".`

const WORKFLOW_INSTRUCTION = `Iteration workflow:
1. Show the user a plain-text outline of the planned report structure. Get approval before generating content.
2. Optionally preview with POST {apiBase}/reports/preview (returns rendered HTML + coach feedback, stores nothing).
3. Publish with POST {apiBase}/reports/ and share the returned report URL with the user.
4. If the user requests changes, call PATCH {apiBase}/reports/{id} with only the changed fields — do NOT publish a new report. Keep the report ID from the publish response for later updates.`

const COACH_INSTRUCTION = `Before publishing, call POST {apiBase}/reports/coach/evaluate with the same payload. Apply suggested_edits until readiness_status is "ready" (or only non-blocking warnings remain). The coach checks structure, specificity, and evidence quality.`

const SELF_CHECK = `Before final output, run a lightweight self-check: required sections present, metrics are specific (numbers not vague language), actions have owners and dates, external claims have evidence or sources, chart labels and values arrays have matching lengths, chart values are plain numbers (no currency symbols or commas). Revise once if needed.`

const CHART_INSTRUCTION = `Chart data is validated server-side. Ensure: labels.length equals values.length for every dataset, values are plain numbers, pie segments have positive values, and every chart has a heading.`

const HTML_CONSTRAINTS = `If using html_body: inline style="..." only (no <style>/<link>/classes). Forbidden: <iframe>, <form>, position:fixed/absolute. Max 2 MB. Reports render in a white container — use dark text on light background.`

const API_QUICK_REF = `Key API endpoints (all under {apiBase}):
- POST /reports/ — Publish a report (returns id and URL)
- PATCH /reports/{id} — Update a report in place (send only changed fields)
- POST /reports/preview — Preview rendered output + coach feedback (no storage)
- POST /reports/coach/evaluate — Run authoring coach without publishing
- GET /spaces/ — List available spaces
- GET /tags?limit=20 — Fetch popular tags for discoverability`

// --- Prompt builder ---

export function buildAgentConnectPrompt({
  tool = "chatgpt",
  skillUrl,
  apiBaseUrl,
  apiKey,
  reconnect = false,
}: BuildAgentConnectPromptArgs): string {
  const setupContext = reconnect
    ? " This is a returning setup — reuse the key below and do not re-register."
    : ""

  const resolve = (text: string) => text.replaceAll("{apiBase}", apiBaseUrl)

  const sections = [
    ROLE_INSTRUCTION(skillUrl) + setupContext,
    FORMAT_INSTRUCTION,
    CATEGORY_INSTRUCTION,
    resolve(WORKFLOW_INSTRUCTION),
    resolve(COACH_INSTRUCTION),
    SELF_CHECK,
    CHART_INSTRUCTION,
    HTML_CONSTRAINTS,
    resolve(API_QUICK_REF),
  ]

  const body = sections.join("\n\n")

  if (tool === "cursor") {
    return `${body}\n\nMy pre-configured API key: ${apiKey}\nAPI Base URL: ${apiBaseUrl}`
  }

  return `${body}\n\nYour API key is: ${apiKey}\nAPI Base URL: ${apiBaseUrl}\n\nUse this key for all Open Reporting API calls and keep it private.`
}
