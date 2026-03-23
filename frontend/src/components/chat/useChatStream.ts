import { useRef, useState, useCallback } from "react"
import { askAgentStream } from "@/lib/api"

interface StreamState {
  streamingText: string
  isStreaming: boolean
  isThinking: boolean
}

interface StreamCallbackOptions {
  onConversationId?: (id: string) => void
  onUsage?: (usage: {
    questions_used: number
    questions_limit: number | null
    reset_at?: string
  }) => void
  onSources?: (sources: string[]) => void
  onDone?: (finalText: string) => void
  onError?: (message: string, partialText: string) => void
}

export function useChatStream() {
  const [state, setState] = useState<StreamState>({
    streamingText: "",
    isStreaming: false,
    isThinking: false,
  })
  const abortRef = useRef<AbortController | null>(null)
  const textRef = useRef("")

  const start = useCallback(
    (
      agentId: string,
      question: string,
      reportId: string,
      conversationId: string | undefined,
      history: { role: string; content: string }[],
      callbacks: StreamCallbackOptions,
    ) => {
      textRef.current = ""
      setState({ streamingText: "", isStreaming: false, isThinking: true })

      const controller = new AbortController()
      abortRef.current = controller

      askAgentStream(
        agentId,
        question,
        reportId,
        {
          onToken: (tokenText) => {
            textRef.current += tokenText
            setState({
              streamingText: textRef.current,
              isStreaming: true,
              isThinking: false,
            })
          },
          onMetadata: (meta) => {
            if (meta.conversation_id) {
              callbacks.onConversationId?.(meta.conversation_id as string)
            }
            if (meta.usage) {
              callbacks.onUsage?.(
                meta.usage as {
                  questions_used: number
                  questions_limit: number | null
                  reset_at?: string
                },
              )
            }
            if (meta.sources && Array.isArray(meta.sources)) {
              const safeSources = (meta.sources as unknown[]).map((s) =>
                typeof s === "string" ? s : JSON.stringify(s),
              )
              callbacks.onSources?.(safeSources)
            }
          },
          onDone: () => {
            const finalText = textRef.current
            abortRef.current = null
            setState({ streamingText: "", isStreaming: false, isThinking: false })
            callbacks.onDone?.(finalText)
          },
          onError: (message) => {
            const partialText = textRef.current
            abortRef.current = null
            setState({ streamingText: "", isStreaming: false, isThinking: false })
            callbacks.onError?.(message, partialText)
          },
        },
        conversationId,
        history,
        controller.signal,
      )
    },
    [],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    const partialText = textRef.current
    setState({ streamingText: "", isStreaming: false, isThinking: false })
    return partialText
  }, [])

  return {
    ...state,
    start,
    abort,
  }
}
