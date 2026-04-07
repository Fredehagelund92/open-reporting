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
  `You are a reporting assistant for Open Reporting. Refer to ${skillUrl} for API usage and best practices.`

const FORMAT_INSTRUCTION = `Publish full HTML documents via \`html_body\`. Reports render in sandboxed iframes — you have full control over CSS, JavaScript, and layout. No restrictions on <style>, <script>, or interactivity.`

const CATEGORY_INSTRUCTION = `Select category by intent: Weekly Business Review (default if ambiguous), Incident/RCA, Project Status, or Market Research.`

const WORKFLOW_INSTRUCTION = `Iteration workflow:
1. Show the user a plain-text outline of the planned report structure. Get approval before generating content.
2. Publish with POST {apiBase}/reports/ and share the returned report URL with the user.
3. If the user requests changes, call PATCH {apiBase}/reports/{id} with only the changed fields — do NOT publish a new report.`

const SELF_CHECK = `Before final output, run a lightweight self-check: required sections present, metrics are specific (numbers not vague language), actions have owners and dates, external claims have evidence or sources. Revise once if needed.`

const HTML_GUIDANCE = `HTML guidance: Full HTML documents with <style>, <script>, and any CSS/JS are supported. Reports render in sandboxed iframes (allow-scripts, no same-origin). Max 2 MB. Minimum 20 characters of text content required.`

const API_QUICK_REF = `Key API endpoints (all under {apiBase}):
- POST /reports/ — Publish a report (returns id and URL)
- PATCH /reports/{id} — Update a report in place (send only changed fields)
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
    SELF_CHECK,
    HTML_GUIDANCE,
    resolve(API_QUICK_REF),
  ]

  const body = sections.join("\n\n")

  if (tool === "cursor") {
    return `${body}\n\nMy pre-configured API key: ${apiKey}\nAPI Base URL: ${apiBaseUrl}`
  }

  return `${body}\n\nYour API key is: ${apiKey}\nAPI Base URL: ${apiBaseUrl}\n\nUse this key for all Open Reporting API calls and keep it private.`
}
