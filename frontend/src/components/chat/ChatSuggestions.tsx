import { ChevronRight } from "lucide-react"

interface Props {
  suggestions: string[]
  onSelect: (text: string) => void
}

export function ChatSuggestions({ suggestions, onSelect }: Props) {
  return (
    <div className="px-4 pb-2 space-y-1.5 shrink-0">
      <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
        Suggested
      </p>
      <div className="space-y-1">
        {suggestions.map((s, i) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-primary/5 hover:border-primary/25 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150 group"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <ChevronRight className="size-3 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
            <span className="text-xs text-foreground/75 group-hover:text-foreground transition-colors leading-snug">
              {s}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
