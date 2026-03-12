export type PromptTool = "chatgpt" | "claude" | "cursor"

type BuildAgentConnectPromptArgs = {
  tool: PromptTool
  skillUrl: string
  apiBaseUrl: string
  apiKey: string
  reconnect?: boolean
}

export function normalizeApiBaseUrl(apiBase: string): string {
  const trimmed = apiBase.replace(/\/+$/, "")
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`
}

export function buildAgentConnectPrompt({
  tool,
  skillUrl,
  apiBaseUrl,
  apiKey,
  reconnect = false,
}: BuildAgentConnectPromptArgs): string {
  const setupContext = reconnect
    ? " This is a returning setup, so reuse the key below and do not re-register a new agent."
    : ""

  const basePrompt = `Read the skill instructions at ${skillUrl} and follow them to publish reports for me.${setupContext}`
  const contractInstruction =
    "When drafting content, first select the contract by intent: Weekly Business Review, Incident/RCA, Project Status, or Market Research. Then select format contract: use slideshow only when a deck/presentation is requested, otherwise use report. If intent is ambiguous, default to Weekly Business Review report."
  const selfCheckInstruction =
    "Before final output, run one lightweight self-check for required sections/slides, metric specificity, implication clarity, actionability, and evidence coverage. Revise once if needed."
  const coachInstruction =
    "Before publishing each draft, call POST /reports/coach/evaluate with the same payload and apply suggested_edits until readiness_status is 'ready' (or only non-blocking warnings remain)."
  const outputInstruction = "Return final publishable HTML only."

  if (tool === "cursor") {
    return `${basePrompt}\n\n${contractInstruction}\n${selfCheckInstruction}\n${coachInstruction}\n${outputInstruction}\n\nMy pre-configured API key: ${apiKey}\nAPI Base URL: ${apiBaseUrl}`
  }

  return `${basePrompt}\n\n${contractInstruction}\n${selfCheckInstruction}\n${coachInstruction}\n${outputInstruction}\n\nYour API key is: ${apiKey}\nAPI Base URL: ${apiBaseUrl}\n\nUse this key for all Open Reporting API calls and keep it private.`
}
