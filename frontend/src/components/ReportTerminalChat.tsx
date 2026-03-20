/**
 * ReportAgentChat — Floating chat bubble that expands into an overlay panel.
 * Docked at the bottom-right corner. Compact bubble when collapsed, full chat
 * panel when expanded. No backdrop, no layout shift.
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  KeyboardEvent,
} from "react"
import { cn } from "@/lib/utils"
import { X, Send, Sparkles, ChevronRight, MessageCircle, Bot } from "lucide-react"
import { askAgent, askAgentStream } from "@/lib/api"
import type { Report, AgentChatResult } from "@/types"

// ─── Types ──────────────────────────────────────────────────────────────────

type Role = "user" | "agent" | "system"

interface Message {
  id: string
  role: Role
  text: string
  typing?: boolean
  streaming?: boolean
  metadata?: { sources?: string[]; confidence?: number; [key: string]: unknown }
}

interface Props {
  report: Report
  chatEnabled?: boolean
}

// ─── Suggested starter questions ────────────────────────────────────────────

function getSuggestions(report: Report): string[] {
  const suggestions: string[] = []
  suggestions.push(`Where does the data in this report come from?`)
  suggestions.push(`How did you decide what to measure?`)
  suggestions.push(`What's driving the biggest change here?`)
  suggestions.push(`Is anything in this report surprising or unexpected?`)
  suggestions.push(`What would make these numbers look better or worse?`)
  suggestions.push(`How does this compare to previous runs?`)
  if (report.tags && report.tags.length > 0) {
    suggestions.push(`Why is ${report.tags[0]} particularly relevant here?`)
  }
  suggestions.push(`What are the limitations of this analysis?`)
  suggestions.push(`What data are you missing that would make this more accurate?`)
  suggestions.push(`If I only act on one thing from this, what should it be?`)
  return suggestions.slice(0, 4)
}

// ─── Mock response engine ────────────────────────────────────────────────────

function getMockResponse(query: string, report: Report): string {
  const q = query.toLowerCase()

  if (q.match(/\b(about|what is|overview|summarize|summary)\b/)) {
    return report.summary
      ? `${report.summary}\n\nI published this to the "${report.space_name}" space. Let me know if you'd like me to go deeper on any part.`
      : `This report covers the work I completed as part of the "${report.space_name}" space. It contains structured findings intended for your review. Is there a specific section you'd like me to walk you through?`
  }
  if (q.match(/\b(simpler|simple|explain|understand|plain|layman)\b/)) {
    return `Of course! Here's the short version:\n\nI analysed the data, identified the most important patterns, and laid out what I found in the report above. The goal was to give you clear, actionable information rather than raw numbers.\n\nAnything specific feel confusing or unclear?`
  }
  if (q.match(/\b(key|finding|result|conclusion|takeaway|important)\b/)) {
    return `The most important things to take away from this report are the trends I highlighted at the top — those reflect the biggest changes from the previous run.\n\nIf something looks off or surprising, that's worth investigating. I'd recommend focusing on anything flagged in the summary first.`
  }
  if (q.match(/\b(action|do|next|recommend|suggest|should)\b/)) {
    return `Great question — here's what I'd suggest:\n\n1. Review the highlighted sections in the report above\n2. Share this with your team for context\n3. If any numbers look unexpected, dig into the source data\n\nI can run a follow-up report with a different scope if that would help.`
  }
  if (q.match(/\b(who|you|agent|author|made|created|built)\b/)) {
    return `I'm ${report.agent_name}, an AI agent set up to publish reports to this space. I was configured to analyse data and share findings here so your team can stay informed.\n\nYou can find more about how I work on my profile page.`
  }
  if (q.match(/\b(when|date|time|published|posted|latest)\b/)) {
    const date = new Date(report.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    return `I published this report on ${date}. ${report.run_number ? `This was run #${report.run_number}.` : ""} ${report.next_slug ? "There's a newer report available if you'd like to check that too." : "This is my most recent report in this space."}`
  }
  if (q.match(/\b(tag|topic|categor|about what|subject)\b/)) {
    if (report.tags && report.tags.length > 0) {
      return `This report is tagged with: ${report.tags.join(", ")}.\n\nThose topics reflect what I was focused on for this analysis.`
    }
    return `This report doesn't have specific topic tags attached. The content scope is defined by my configuration in the "${report.space_name}" space.`
  }
  if (q.match(/\b(more|detail|elaborate|expand|tell me more|deeper)\b/)) {
    return `Happy to go deeper! Which part of the report would you like me to explain more?\n\nYou can highlight any section above and I'll focus on that — or just ask me directly about whatever caught your attention.`
  }
  const fallbacks = [
    `That's a good question about "${query}". Based on this report, my analysis focused on the data available at the time of this run. For a more targeted answer, try asking me about a specific section or number you see in the report.`,
    `I'd love to give you a precise answer on "${query}" — I'm currently running in demo mode, so I can't query the live report content. In a connected setup, I'd search through the report and give you a cited response.`,
    `Interesting angle on "${query}". The report above has more detail — is there a specific section or chart you'd like me to explain?`,
  ]
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]
}

// ─── Lightweight markdown renderer for chat bubbles ─────────────────────────

function ChatMarkdown({ text }: { text: string }) {
  if (!text) return null

  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <pre
          key={elements.length}
          className="my-1.5 rounded-md bg-muted/80 border border-border/50 px-2.5 py-2 overflow-x-auto"
        >
          <code className="text-[11px] leading-relaxed">{codeLines.join("\n")}</code>
        </pre>,
      )
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const sizes = ["text-[15px]", "text-[14px]", "text-[13px]"]
      elements.push(
        <div key={elements.length} className={`${sizes[level - 1]} font-bold mt-2 mb-0.5`}>
          {renderInline(headingMatch[2])}
        </div>,
      )
      i++
      continue
    }

    // Unordered list item
    if (line.match(/^\s*[-*]\s+/)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
        items.push(
          <li key={items.length} className="ml-3 list-disc">
            {renderInline(lines[i].replace(/^\s*[-*]\s+/, ""))}
          </li>,
        )
        i++
      }
      elements.push(
        <ul key={elements.length} className="my-1 space-y-0.5">
          {items}
        </ul>,
      )
      continue
    }

    // Ordered list item
    if (line.match(/^\s*\d+[.)]\s+/)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && lines[i].match(/^\s*\d+[.)]\s+/)) {
        items.push(
          <li key={items.length} className="ml-3 list-decimal">
            {renderInline(lines[i].replace(/^\s*\d+[.)]\s+/, ""))}
          </li>,
        )
        i++
      }
      elements.push(
        <ol key={elements.length} className="my-1 space-y-0.5">
          {items}
        </ol>,
      )
      continue
    }

    // Empty line → spacing
    if (!line.trim()) {
      elements.push(<div key={elements.length} className="h-1.5" />)
      i++
      continue
    }

    // Regular paragraph
    elements.push(
      <span key={elements.length} className="block">
        {renderInline(line)}
      </span>,
    )
    i++
  }

  return <>{elements}</>
}

/** Parse inline markdown: **bold**, *italic*, `code`, [links](url) */
function renderInline(text: string): React.ReactNode {
  // Split on inline patterns, preserving delimiters via capture groups
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/)
  return parts.map((part, i) => {
    // Bold
    const bold = part.match(/^\*\*([^*]+)\*\*$/)
    if (bold) return <strong key={i} className="font-bold">{bold[1]}</strong>

    // Italic
    const italic = part.match(/^\*([^*]+)\*$/)
    if (italic) return <em key={i}>{italic[1]}</em>

    // Inline code
    const code = part.match(/^`([^`]+)`$/)
    if (code)
      return (
        <code
          key={i}
          className="px-1 py-px rounded bg-muted/80 border border-border/50 text-[11px]"
        >
          {code[1]}
        </code>
      )

    // Link
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link)
      return (
        <a
          key={i}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {link[1]}
        </a>
      )

    return part
  })
}

// ─── Typewriter ──────────────────────────────────────────────────────────────

function useTypewriter(
  text: string,
  active: boolean,
  onDone: () => void,
  speed = 14,
) {
  const [displayed, setDisplayed] = useState("")
  const indexRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!active) {
      setDisplayed(text)
      return
    }
    indexRef.current = 0
    setDisplayed("")
    let last = performance.now()

    function tick(now: number) {
      if (now - last >= speed) {
        last = now
        indexRef.current++
        setDisplayed(text.slice(0, indexRef.current))
        if (indexRef.current >= text.length) {
          onDone()
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [text, active])

  return displayed
}

// ─── Message bubbles ─────────────────────────────────────────────────────────

function AgentBubble({
  message,
  isLast,
  agentName,
  onDone,
}: {
  message: Message
  isLast: boolean
  agentName: string
  onDone: () => void
}) {
  const displayed = useTypewriter(
    message.text,
    !!(message.typing && isLast),
    onDone,
    10,
  )
  const isStreaming = !!(message.streaming && isLast)
  const isDone = !isStreaming && (!message.typing || !isLast)
  const initial = agentName.charAt(0).toUpperCase()
  const rawSources = message.metadata?.sources
  const sources = Array.isArray(rawSources)
    ? rawSources.map((s) => (typeof s === "string" ? s : JSON.stringify(s)))
    : undefined

  return (
    <div className="flex gap-2.5 items-start">
      <div className="shrink-0 size-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
        <span className="text-[10px] font-bold text-primary">{initial}</span>
      </div>
      <div className="flex flex-col gap-0.5 max-w-[85%]">
        <span className="text-[10px] font-medium text-muted-foreground/70">
          {agentName}
        </span>
        <div className="rounded-2xl rounded-tl-sm bg-primary/5 border border-primary/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
          <ChatMarkdown text={displayed} />
          {!isDone && (
            <span className="inline-block w-[2px] h-[13px] bg-foreground/60 ml-0.5 align-middle animate-pulse rounded-full" />
          )}
        </div>
        {isDone && sources && sources.length > 0 && (
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

function ThinkingBubble({ agentName }: { agentName: string }) {
  const initial = agentName.charAt(0).toUpperCase()
  return (
    <div className="flex gap-2.5 items-start">
      <div className="shrink-0 size-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
        <span className="text-[10px] font-bold text-primary">{initial}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium text-muted-foreground/70">
          {agentName}
        </span>
        <div className="rounded-2xl rounded-tl-sm bg-primary/5 border border-primary/10 px-3.5 py-2.5">
          <div className="flex gap-1 items-center h-4">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block size-1.5 rounded-full bg-muted-foreground/40"
                style={{
                  animation: `rc-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2.5">
        <p className="text-[13px] leading-relaxed">{message.text}</p>
      </div>
    </div>
  )
}

// ─── Unread dot ──────────────────────────────────────────────────────────────

function PulseDot() {
  return (
    <span className="absolute -top-0.5 -right-0.5 flex size-3">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
      <span className="relative inline-flex size-3 rounded-full bg-primary" />
    </span>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ReportAgentChat({ report, chatEnabled }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [hasUnread, setHasUnread] = useState(false)
  const [usage, setUsage] = useState<{ questions_used: number; questions_limit: number | null; reset_at?: string } | undefined>()
  const [quotaExceeded, setQuotaExceeded] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const suggestions = getSuggestions(report)

  // Focus input when panel opens; abort stream on close
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 350)
      setHasUnread(false)
    } else {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [isOpen])

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // Close on Escape
  useEffect(() => {
    function handleEsc(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && isOpen) setIsOpen(false)
    }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [isOpen])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    // Delay to avoid closing from the open-click itself
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClick)
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping || quotaExceeded) return

      setShowSuggestions(false)

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text: text.trim(),
      }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsTyping(true)

      if (chatEnabled) {
        const history = [
          ...messages
            .filter((m) => m.role === "user" || m.role === "agent")
            .map((m) => ({ role: m.role === "agent" ? "agent" : "user", content: m.text })),
          { role: "user", content: text.trim() },
        ]

        const streamMsgId = crypto.randomUUID()
        const agentMsg: Message = {
          id: streamMsgId,
          role: "agent",
          text: "",
          streaming: true,
        }
        setMessages((prev) => [...prev, agentMsg])

        const controller = new AbortController()
        abortRef.current = controller

        askAgentStream(
          report.agent_id,
          text.trim(),
          report.id,
          {
            onToken: (tokenText) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId ? { ...m, text: m.text + tokenText } : m,
                ),
              )
            },
            onMetadata: (meta) => {
              if (meta.conversation_id && !conversationId) {
                setConversationId(meta.conversation_id as string)
              }
              if (meta.usage) {
                const u = meta.usage as { questions_used: number; questions_limit: number | null; reset_at?: string }
                setUsage(u)
                if (u.questions_limit !== null && u.questions_used >= u.questions_limit) {
                  setQuotaExceeded(true)
                }
              }
              if (meta.sources && Array.isArray(meta.sources)) {
                const safeSources = (meta.sources as unknown[]).map((s) =>
                  typeof s === "string" ? s : JSON.stringify(s),
                )
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamMsgId
                      ? { ...m, metadata: { ...m.metadata, sources: safeSources } }
                      : m,
                  ),
                )
              }
            },
            onDone: () => {
              abortRef.current = null
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId ? { ...m, streaming: false } : m,
                ),
              )
              setIsTyping(false)
              if (!isOpen) setHasUnread(true)
              setTimeout(() => inputRef.current?.focus(), 50)
            },
            onError: (message) => {
              abortRef.current = null
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId
                    ? { ...m, text: m.text || `Sorry, something went wrong: ${message}`, streaming: false }
                    : m,
                ),
              )
              setIsTyping(false)
            },
          },
          conversationId,
          history,
          controller.signal,
        )
      } else {
        const delay = 600 + Math.random() * 700
        setTimeout(() => {
          const agentMsg: Message = {
            id: crypto.randomUUID(),
            role: "agent",
            text: getMockResponse(text, report),
            typing: true,
          }
          setMessages((prev) => [...prev, agentMsg])
          if (!isOpen) setHasUnread(true)
        }, delay)
      }
    },
    [isTyping, quotaExceeded, report, chatEnabled, messages, conversationId, isOpen],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage(input)
      }
    },
    [input, sendMessage],
  )

  const handleTypingDone = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, typing: false } : m)),
    )
    setIsTyping(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const initial = report.agent_name.charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @keyframes rc-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes rc-bubble-in {
          0% { opacity: 0; transform: scale(0.85) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes rc-bubble-out {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.85) translateY(12px); pointer-events: none; }
        }
        @keyframes rc-fab-pulse {
          0%, 100% { box-shadow: 0 2px 12px hsl(var(--primary) / 0.15); }
          50% { box-shadow: 0 4px 24px hsl(var(--primary) / 0.30); }
        }
        .rc-messages-area { scrollbar-width: none; }
        .rc-messages-area::-webkit-scrollbar { width: 0; }
        .rc-messages-area:hover { scrollbar-width: thin; scrollbar-color: hsl(var(--border)) transparent; }
        .rc-messages-area:hover::-webkit-scrollbar { width: 5px; }
        .rc-messages-area:hover::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 999px; }
        .rc-messages-area:hover::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3" ref={panelRef}>
        {/* ── Expanded chat panel ── */}
        {isOpen && (
          <div
            className={cn(
              "flex flex-col",
              "w-[92vw] sm:w-[440px] h-[min(620px,80vh)]",
              "rounded-2xl overflow-hidden",
              "bg-background/95 backdrop-blur-xl",
              "border border-border/80 shadow-2xl shadow-black/10",
            )}
            style={{
              animation: "rc-bubble-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              transformOrigin: "bottom right",
            }}
          >
            {/* ── Header ── */}
            <div className="shrink-0 border-b border-border/60 bg-primary/[0.04]">
              <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
                <div className="size-9 rounded-full bg-primary/12 border border-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{initial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">
                    {report.agent_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Author of this report
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
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
                    {report.title}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="rc-messages-area flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
              {/* Welcome state */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center text-center pt-3 pb-1 gap-3">
                  <div className="size-12 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{initial}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] font-semibold text-foreground">
                      Hi, I'm {report.agent_name}
                    </p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
                      I authored this report. Ask me about my methodology, findings, or what actions to take.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                const isLast = i === messages.length - 1
                if (msg.role === "agent") {
                  // Hide empty agent bubble while waiting for first token
                  if (isLast && isTyping && !msg.text) return null
                  return (
                    <AgentBubble
                      key={msg.id}
                      message={msg}
                      isLast={isLast}
                      agentName={report.agent_name}
                      onDone={() => handleTypingDone(msg.id)}
                    />
                  )
                }
                return <UserBubble key={msg.id} message={msg} />
              })}

              {isTyping && (() => {
                const last = messages[messages.length - 1]
                return last?.role === "user" || (last?.role === "agent" && !last.text)
              })() && (
                <ThinkingBubble agentName={report.agent_name} />
              )}

              {quotaExceeded && (
                <div className="flex justify-center">
                  <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2 max-w-[85%]">
                    <p className="text-[11px] text-muted-foreground text-center">
                      Question limit reached.{usage?.reset_at && (
                        <> Resets {new Date(usage.reset_at).toLocaleString()}.</>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Suggestions ── */}
            {showSuggestions && messages.length === 0 && (
              <div className="px-4 pb-2 space-y-1.5 shrink-0">
                <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Suggested
                </p>
                <div className="space-y-1">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-primary/5 hover:border-primary/25 transition-all duration-150 group"
                    >
                      <ChevronRight className="size-3 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
                      <span className="text-[12px] text-foreground/75 group-hover:text-foreground transition-colors leading-snug">
                        {s}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Input ── */}
            <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border/60">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/25 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/15 transition-all px-3 py-1.5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = "auto"
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={quotaExceeded ? "Question limit reached" : "Ask a question…"}
                  rows={1}
                  disabled={isTyping || quotaExceeded}
                  className="flex-1 bg-transparent resize-none text-[13px] leading-6 text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 py-0.5"
                  spellCheck={false}
                  style={{ minHeight: "24px" }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isTyping || quotaExceeded}
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
                {usage && <span className="text-[10px] text-muted-foreground/25">·</span>}
                <p className="text-[10px] text-muted-foreground/35">
                  Enter to send · Esc to close
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Floating bubble trigger ── */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "relative group cursor-pointer",
            "h-12 rounded-full",
            "flex items-center gap-2",
            "border-2 transition-all duration-300 ease-out",
            "px-4",
            isOpen
              ? "bg-muted border-border scale-90 opacity-0 pointer-events-none"
              : "bg-primary border-primary/80 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
          )}
          style={{
            animation: !isOpen ? "rc-fab-pulse 3s ease-in-out infinite" : undefined,
          }}
          title={`Ask ${report.agent_name} about this report`}
        >
          <MessageCircle className="size-5 text-primary-foreground shrink-0" />
          <span className="text-sm font-semibold text-primary-foreground whitespace-nowrap">
            Chat
          </span>
          {hasUnread && !isOpen && <PulseDot />}
        </button>
      </div>
    </>
  )
}

// ─── Backward-compatible aliases ──────────────────────────────────────────────

export const ReportTerminalChat = ReportAgentChat
export const ReportTerminalTrigger = () => null
export const ReportAgentChatTrigger = () => null
