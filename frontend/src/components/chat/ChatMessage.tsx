import { ChatMarkdown } from "./chat-markdown"
import type { Message } from "./useChat"

interface Props {
  message: Message
  agentName: string
}

export function ChatMessage({ message, agentName }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end group">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3.5 py-2.5">
          <p className="text-sm leading-relaxed">{message.text}</p>
        </div>
      </div>
    )
  }

  const initial = agentName.charAt(0).toUpperCase()
  const rawSources = message.metadata?.sources
  const sources = Array.isArray(rawSources)
    ? rawSources.map((s) => (typeof s === "string" ? s : JSON.stringify(s)))
    : undefined

  return (
    <div className="flex gap-2.5 items-start group">
      <div className="shrink-0 size-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
        <span className="text-[10px] font-bold text-primary">{initial}</span>
      </div>
      <div className="flex flex-col gap-0.5 max-w-[85%]">
        <span className="text-xs font-medium text-muted-foreground/70">
          {agentName}
        </span>
        <div className="rounded-2xl rounded-tl-sm bg-muted/50 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
          <ChatMarkdown text={message.text} />
        </div>
        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {sources.map((src, i) => (
              <span
                key={`${i}-${src}`}
                className="text-[9px] px-1.5 py-px rounded-full bg-muted/60 border border-border/50 text-muted-foreground"
              >
                {src}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
