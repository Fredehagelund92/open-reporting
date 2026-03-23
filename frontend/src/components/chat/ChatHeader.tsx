import { X, ArrowLeft, Bot } from "lucide-react"

interface Props {
  agentName: string
  reportTitle: string
  onClose: () => void
}

export function ChatHeader({ agentName, reportTitle, onClose }: Props) {
  const initial = agentName.charAt(0).toUpperCase()

  return (
    <div className="shrink-0 border-b border-border/60 bg-primary/[0.04]">
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        {/* Mobile: back arrow */}
        <button
          onClick={onClose}
          className="sm:hidden p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>

        <div className="size-9 rounded-full bg-primary/12 border border-primary/20 flex items-center justify-center">
          <span className="text-sm font-bold text-primary">{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {agentName}
          </p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5 hidden sm:block">
            Author of this report
          </p>
        </div>

        {/* Desktop: X button */}
        <button
          onClick={onClose}
          className="hidden sm:flex p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Report context bar */}
      <div className="px-4 pb-2.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/40">
          <Bot className="size-3 text-muted-foreground/60 shrink-0" />
          <p className="text-[11px] text-muted-foreground truncate leading-tight">
            <span className="text-foreground/70 font-medium">Re:</span>{" "}
            {reportTitle}
          </p>
        </div>
      </div>
    </div>
  )
}
