/**
 * ChatPanel — Floating chat bubble that expands into an overlay panel.
 * Desktop: 440px floating panel at bottom-right with spring animation.
 * Mobile (<640px): Full-screen takeover with slide-up animation.
 */

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import { useChat } from "./useChat"
import { ChatFab } from "./ChatFab"
import { ChatHeader } from "./ChatHeader"
import { ChatMessages } from "./ChatMessages"
import { ChatInput } from "./ChatInput"
import { ChatSuggestions } from "./ChatSuggestions"
import { StopButton } from "./StopButton"
import { LogIn } from "lucide-react"
import type { Report } from "@/types"

interface Props {
  report: Report
  chatEnabled?: boolean
}

export function ChatPanel({ report, chatEnabled = false }: Props) {
  const { isAuthenticated } = useAuth()
  const chat = useChat(report, chatEnabled)
  const { isOpen, openChat, closeChat } = chat
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) closeChat()
    }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [isOpen, closeChat])

  // Close on outside click (desktop only)
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeChat()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick)
    }, 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClick)
    }
  }, [isOpen, closeChat])

  return (
    <>
      <style>{`
        @keyframes chat-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes chat-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes chat-fab-pulse {
          0%, 100% { box-shadow: 0 2px 12px hsl(var(--primary) / 0.15); }
          50% { box-shadow: 0 4px 24px hsl(var(--primary) / 0.30); }
        }
        @keyframes chat-panel-in {
          0% { opacity: 0; transform: scale(0.9) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes chat-panel-slide-up {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        .chat-messages-area { scrollbar-width: thin; scrollbar-color: hsl(var(--border) / 0.4) transparent; }
        .chat-messages-area::-webkit-scrollbar { width: 5px; }
        .chat-messages-area::-webkit-scrollbar-thumb { background: hsl(var(--border) / 0.4); border-radius: 999px; }
        .chat-messages-area::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3"
        ref={panelRef}
      >
        {/* ── Expanded chat panel ── */}
        <div
          className={cn(
            "flex flex-col overflow-hidden",
            // Mobile: full-screen takeover
            "fixed inset-0 sm:relative sm:inset-auto",
            "bg-background sm:bg-background/95 sm:backdrop-blur-xl",
            "sm:w-[440px] sm:h-[min(620px,80vh)]",
            "sm:rounded-2xl sm:border sm:border-border/80 sm:shadow-2xl sm:shadow-black/10",
            !isOpen && "hidden",
          )}
          style={{
            animation: isOpen
              ? (window.innerWidth < 640
                ? "chat-panel-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
                : "chat-panel-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards")
              : undefined,
            transformOrigin: "bottom right",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
            <ChatHeader
              agentName={report.agent_name}
              reportTitle={report.title}
              onClose={closeChat}
            />

            <ChatMessages
              messages={chat.messages}
              isThinking={chat.isThinking}
              isStreaming={chat.isStreaming}
              streamingText={chat.streamingText}
              agentName={report.agent_name}
              quotaExceeded={chat.quotaExceeded}
              usage={chat.usage}
            />

            {/* Suggestions — only on first open with no messages */}
            {chat.showSuggestions && chat.messages.length === 0 && !chat.isThinking && (
              <ChatSuggestions
                suggestions={chat.suggestions}
                onSelect={(text) => chat.send(text)}
              />
            )}

            {/* Stop generating button */}
            <StopButton
              onStop={chat.stop}
              visible={chat.isStreaming}
            />

            {chatEnabled && !isAuthenticated ? (
              <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border/60 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                <a
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-border bg-muted/25 px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <LogIn className="size-4" />
                  Sign in to ask questions
                </a>
              </div>
            ) : (
              <ChatInput
                value={chat.input}
                onChange={chat.setInput}
                onSend={chat.send}
                disabled={chat.isBusy}
                quotaExceeded={chat.quotaExceeded}
                usage={chat.usage}
                inputRef={chat.inputRef}
              />
            )}
          </div>

        {/* ── Floating bubble trigger ── */}
        {!isOpen && (
          <ChatFab
            onClick={openChat}
            hasUnread={chat.hasUnread}
            agentName={report.agent_name}
          />
        )}
      </div>
    </>
  )
}
