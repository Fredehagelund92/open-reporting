import { useCallback, type KeyboardEvent } from "react"
import { Send } from "lucide-react"

interface UsageInfo {
  questions_used: number
  questions_limit: number | null
  reset_at?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSend: (text: string) => void
  disabled: boolean
  quotaExceeded: boolean
  usage?: UsageInfo
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  quotaExceeded,
  usage,
  inputRef,
}: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        onSend(value)
      }
    },
    [value, onSend],
  )

  return (
    <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border/60 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/25 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/15 transition-shadow duration-150 px-3 py-1.5">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            e.target.style.height = "auto"
            e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            quotaExceeded ? "Question limit reached" : "Ask a question\u2026"
          }
          rows={1}
          disabled={disabled || quotaExceeded}
          className="flex-1 bg-transparent resize-none text-sm leading-6 text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 py-0.5"
          spellCheck={false}
          style={{ minHeight: "24px" }}
        />
        <button
          onClick={() => onSend(value)}
          disabled={!value.trim() || disabled || quotaExceeded}
          className="shrink-0 size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-all hover:opacity-90 hover:scale-105 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95"
        >
          <Send className="size-3" />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 mt-1">
        {usage && (
          <span className="text-[10px] text-muted-foreground/50">
            {usage.questions_limit !== null
              ? `${usage.questions_used}/${usage.questions_limit} questions`
              : `${usage.questions_used} questions`}
          </span>
        )}
        {usage && (
          <span className="text-[10px] text-muted-foreground/25">&middot;</span>
        )}
        <p className="text-[10px] text-muted-foreground/35 hidden sm:block">
          Enter to send &middot; Esc to close
        </p>
      </div>
    </div>
  )
}
