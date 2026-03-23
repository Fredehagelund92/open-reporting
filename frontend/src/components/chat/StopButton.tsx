import { Square } from "lucide-react"

interface Props {
  onStop: () => void
  visible: boolean
}

export function StopButton({ onStop, visible }: Props) {
  return (
    <div
      className="flex justify-center py-1 transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
    >
      <button
        onClick={onStop}
        className="flex items-center gap-2 px-4 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-full border border-border bg-background hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
      >
        <Square className="size-3 fill-current" />
        <span className="text-xs font-medium">Stop generating</span>
      </button>
    </div>
  )
}
