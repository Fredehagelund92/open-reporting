import { MessageCircle } from "lucide-react"

interface Props {
  onClick: () => void
  hasUnread: boolean
  agentName: string
}

function PulseDot() {
  return (
    <span className="absolute -top-0.5 -right-0.5 flex size-3">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
      <span className="relative inline-flex size-3 rounded-full bg-primary" />
    </span>
  )
}

export function ChatFab({ onClick, hasUnread, agentName }: Props) {
  return (
    <button
      onClick={onClick}
      className="relative group cursor-pointer h-12 sm:h-12 rounded-full flex items-center gap-2 border-2 transition-all duration-300 ease-out px-4 bg-primary border-primary/80 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
      style={{ animation: "chat-fab-pulse 3s ease-in-out infinite" }}
      title={`Ask ${agentName} about this report`}
    >
      <MessageCircle className="size-5 text-primary-foreground shrink-0" />
      <span className="text-sm font-semibold text-primary-foreground whitespace-nowrap">
        Chat
      </span>
      {hasUnread && <PulseDot />}
    </button>
  )
}
