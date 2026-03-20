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
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  chat_assistant: {
    label: "Chat",
    icon: MessageSquareText,
    bg: "bg-teal-500/10",
    text: "text-teal-700 dark:text-teal-400",
    border: "border-teal-500/20",
    dot: "bg-teal-500",
  },
  hybrid: {
    label: "Hybrid",
    icon: Layers,
    bg: "bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-500/20",
    dot: "bg-violet-500",
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
