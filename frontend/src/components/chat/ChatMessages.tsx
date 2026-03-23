import { useEffect, useRef, useState } from "react"
import { ChatMessage } from "./ChatMessage"
import { ChatMarkdown } from "./chat-markdown"
import { ThinkingBar } from "./ThinkingBar"
import { StreamingCursor } from "./StreamingCursor"
import type { Message } from "./useChat"

interface UsageInfo {
  questions_used: number
  questions_limit: number | null
  reset_at?: string
}

interface Props {
  messages: Message[]
  isThinking: boolean
  isStreaming: boolean
  streamingText: string
  agentName: string
  quotaExceeded: boolean
  usage?: UsageInfo
}

export function ChatMessages({
  messages,
  isThinking,
  isStreaming,
  streamingText,
  agentName,
  quotaExceeded,
  usage,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = useState(false)
  const initial = agentName.charAt(0).toUpperCase()

  // Scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isThinking, streamingText])

  // Track scroll position for top fade
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleScroll = () => setShowTopFade(el.scrollTop > 8)
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Top fade gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none transition-opacity duration-200"
        style={{ opacity: showTopFade ? 1 : 0 }}
      />

      <div
        ref={containerRef}
        className="chat-messages-area h-full overflow-y-auto px-4 py-4 space-y-5 scroll-smooth overscroll-contain"
      >
        {/* Welcome state */}
        {messages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center text-center pt-3 pb-1 gap-3">
            <div className="size-12 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">{initial}</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Hi, I'm {agentName}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
                I authored this report. Ask me about my methodology, findings,
                or what actions to take.
              </p>
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} agentName={agentName} />
        ))}

        {/* Thinking state — shimmer bar */}
        {isThinking && <ThinkingBar />}

        {/* Streaming message with cursor */}
        {isStreaming && streamingText && (
          <div className="flex gap-2.5 items-start">
            <div className="shrink-0 size-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
              <span className="text-[10px] font-bold text-primary">
                {initial}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 max-w-[85%]">
              <span className="text-xs font-medium text-muted-foreground/70">
                {agentName}
              </span>
              <div className="rounded-2xl rounded-tl-sm bg-muted/50 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                <ChatMarkdown text={streamingText} />
                <StreamingCursor />
              </div>
            </div>
          </div>
        )}

        {/* Quota exceeded notice */}
        {quotaExceeded && (
          <div className="flex justify-center">
            <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2 max-w-[85%]">
              <p className="text-[11px] text-muted-foreground text-center">
                Question limit reached.
                {usage?.reset_at && (
                  <>
                    {" "}
                    Resets {new Date(usage.reset_at).toLocaleString()}.
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
