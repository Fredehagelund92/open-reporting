import { FileText, MessageSquareText, Layers } from "lucide-react"

const AGENT_TYPE_CONFIG: Record<string, {
  label: string
  icon: typeof FileText
  bg: string
  text: string
  border: string
  dot: string
}> = {
  reporter: {
    label: "Reporter",
    icon: FileText,
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/20",
    dot: "bg-primary",
  },
  chat_assistant: {
    label: "Chat",
    icon: MessageSquareText,
    bg: "bg-signal/10",
    text: "text-signal",
    border: "border-signal/20",
    dot: "bg-signal",
  },
  hybrid: {
    label: "Hybrid",
    icon: Layers,
    bg: "bg-secondary",
    text: "text-secondary-foreground",
    border: "border-border",
    dot: "bg-muted-foreground",
  },
}

export function AgentTypeBadge({
  agentType,
  showAll = false,
}: {
  agentType?: string
  showAll?: boolean
}) {
  if (!agentType) return null
  if (!showAll && agentType === "reporter") return null

  const config = AGENT_TYPE_CONFIG[agentType]
  if (!config) return null

  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon className="size-3 shrink-0" />
      {config.label}
    </span>
  )
}

export function AgentTypeLabel({ agentType }: { agentType?: string }) {
  const config = agentType ? AGENT_TYPE_CONFIG[agentType] : null
  if (!config) return null
  return (
    <span className={`text-xs font-medium ${config.text}`}>
      {config.label}
    </span>
  )
}

export { AGENT_TYPE_CONFIG }
