import { useEffect, useRef, useState, useCallback } from "react"
import { useChatStream } from "./useChatStream"
import type { Report } from "@/types"

type Role = "user" | "agent" | "system"

export interface Message {
  id: string
  role: Role
  text: string
  metadata?: { sources?: string[]; confidence?: number; [key: string]: unknown }
}

interface UsageInfo {
  questions_used: number
  questions_limit: number | null
  reset_at?: string
}

// ── Suggested starter questions ─────────────────────────────────────────────

function getSuggestions(report: Report): string[] {
  const suggestions: string[] = []
  suggestions.push("Where does the data in this report come from?")
  suggestions.push("How did you decide what to measure?")
  suggestions.push("What's driving the biggest change here?")
  suggestions.push("Is anything in this report surprising or unexpected?")
  suggestions.push("What would make these numbers look better or worse?")
  suggestions.push("How does this compare to previous runs?")
  if (report.tags && report.tags.length > 0) {
    suggestions.push(`Why is ${report.tags[0]} particularly relevant here?`)
  }
  suggestions.push("What are the limitations of this analysis?")
  suggestions.push("What data are you missing that would make this more accurate?")
  suggestions.push("If I only act on one thing from this, what should it be?")
  return suggestions.slice(0, 4)
}

// ── Mock response engine ────────────────────────────────────────────────────

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

// ── Hook ────────────────────────────────────────────────────────────────────

export function useChat(report: Report, chatEnabled: boolean) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [hasUnread, setHasUnread] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | undefined>()
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isOpenRef = useRef(isOpen)

  const stream = useChatStream()
  const suggestions = getSuggestions(report)
  const streamAbort = stream.abort

  // Track current streaming message id for finalizing
  const streamMsgIdRef = useRef<string | null>(null)
  const streamSourcesRef = useRef<string[] | undefined>(undefined)

  // Keep isOpenRef in sync
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  // Wrap setIsOpen to clear unread when opening
  const openChat = useCallback(() => {
    setIsOpen(true)
    setHasUnread(false)
  }, [])

  const closeChat = useCallback(() => {
    setIsOpen(false)
    // Don't abort the stream — keep it running in background so the
    // thinking/streaming state is preserved when the user reopens.
  }, [])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [isOpen])

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || isBusy || quotaExceeded) return

      setShowSuggestions(false)
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text: text.trim(),
      }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsBusy(true)

      if (chatEnabled) {
        const streamMsgId = crypto.randomUUID()
        streamMsgIdRef.current = streamMsgId
        streamSourcesRef.current = undefined

        stream.start(
          report.agent_id,
          text.trim(),
          report.id,
          conversationId,
          [], // history is now managed server-side
          {
            onConversationId: (id) => {
              if (!conversationId) setConversationId(id)
            },
            onUsage: (u) => {
              setUsage(u)
              if (
                u.questions_limit !== null &&
                u.questions_used >= u.questions_limit
              ) {
                setQuotaExceeded(true)
              }
            },
            onSources: (sources) => {
              streamSourcesRef.current = sources
            },
            onDone: (finalText) => {
              const sources = streamSourcesRef.current
              setMessages((prev) => [
                ...prev,
                {
                  id: streamMsgId,
                  role: "agent",
                  text: finalText,
                  metadata: sources ? { sources } : undefined,
                },
              ])
              streamMsgIdRef.current = null
              setIsBusy(false)
              if (!isOpenRef.current) setHasUnread(true)
              setTimeout(() => inputRef.current?.focus(), 50)
            },
            onError: (message, partialText) => {
              setMessages((prev) => [
                ...prev,
                {
                  id: streamMsgId,
                  role: "agent",
                  text:
                    partialText ||
                    `Sorry, something went wrong: ${message}`,
                },
              ])
              streamMsgIdRef.current = null
              setIsBusy(false)
            },
          },
        )
      } else {
        // Mock / demo mode
        const delay = 600 + Math.random() * 700
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "agent",
              text: getMockResponse(text, report),
            },
          ])
          setIsBusy(false)
          if (!isOpenRef.current) setHasUnread(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }, delay)
      }
    },
    [isBusy, quotaExceeded, report, chatEnabled, messages, conversationId, stream],
  )

  const stop = useCallback(() => {
    const partialText = streamAbort()
    const id = streamMsgIdRef.current
    if (id && partialText) {
      setMessages((prev) => [
        ...prev,
        { id, role: "agent", text: partialText },
      ])
    }
    streamMsgIdRef.current = null
    setIsBusy(false)
  }, [streamAbort])

  return {
    // State
    messages,
    input,
    setInput,
    isOpen,
    openChat,
    closeChat,
    showSuggestions,
    hasUnread,
    usage,
    quotaExceeded,
    isBusy,
    suggestions,

    // Streaming state
    isThinking: stream.isThinking,
    isStreaming: stream.isStreaming,
    streamingText: stream.streamingText,

    // Actions
    send,
    stop,
    inputRef,
  }
}
