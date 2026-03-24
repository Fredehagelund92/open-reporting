/**
 * Report Viewer Page - Displays the full HTML report, upvote controls, and a comment section.
 * URL: /report/:reportId
 */

import { useEffect, useState, useRef } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarColor, getInitials } from "@/lib/user"
import { MentionedText } from "@/components/MentionedText"
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Bot,
  Send,
  Bookmark,
  Maximize2,
  Minimize2,
  Smile,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Highlighter,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { timeAgo } from "@/lib/time"
import DOMPurify from "dompurify"
import { SlideshowViewer } from "@/components/SlideshowViewer"

/** Shared DOMPurify config for rendering agent-submitted HTML reports. */
const REPORT_SANITIZE_CONFIG: DOMPurify.Config = {
  ADD_TAGS: [
    "canvas", "svg", "path", "circle", "rect", "line", "polyline",
    "polygon", "text", "g", "defs", "clippath", "use",
  ],
  ADD_ATTR: [
    "style", "viewbox", "fill", "stroke", "stroke-width", "d",
    "cx", "cy", "r", "x", "y", "x1", "x2", "y1", "y2", "points",
    "width", "height", "transform", "role", "aria-label", "xmlns",
    "preserveaspectratio", "stroke-dasharray", "dominant-baseline",
    "text-anchor", "fill-opacity", "rx",
  ],
  FORBID_TAGS: [
    "script", "style", "iframe", "form", "input", "textarea", "select",
    "button", "embed", "object", "applet", "meta", "base", "link",
  ],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  ALLOW_DATA_ATTR: true,
  RETURN_TRUSTED_TYPE: false,
}

import { cn } from "@/lib/utils"
import { type Report, type ReportComment } from "@/types"
import { ReportAgentChat } from "@/components/ReportTerminalChat"

export function ReportViewerPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const queryClient = useQueryClient()

  const { data: report, isLoading: loadingReport } = useQuery<Report>({
    queryKey: ["report", slug],
    queryFn: async () => {
      const res = await api.get(`/reports/${slug}`)
      return res.data
    },
    enabled: !!slug
  })

  const { data: comments = [] } = useQuery<ReportComment[]>({
    queryKey: ["comments", report?.id],
    queryFn: async () => {
      const res = await api.get(`/reports/${report?.id}/comments`)
      return res.data
    },
    enabled: !!report?.id
  })

  // Ref for the report body wrapper (position: relative container for overlays)
  const reportWrapperRef = useRef<HTMLDivElement>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const discussionRef = useRef<HTMLElement>(null)
  const pendingQuoteRef = useRef<string>("")
  const tooltipClickedRef = useRef(false)

  // Text selection comment state
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null)
  const selectedQuoteRef = useRef<string | null>(null)
  // Keep a ref in sync so event-handler closures can read the latest value
  useEffect(() => { selectedQuoteRef.current = selectedQuote }, [selectedQuote])

  const [selectionTooltip, setSelectionTooltip] = useState<{
    top: number
    left: number
  } | null>(null)

  // Highlight overlays — absolutely positioned divs rendered by React
  const [highlightRects, setHighlightRects] = useState<
    { top: number; left: number; width: number; height: number }[]
  >([])

  const [showSelectHint, setShowSelectHint] = useState(() => {
    try { return localStorage.getItem("or-select-hint-dismissed") !== "1" }
    catch { return true }
  })

  const [vote, setVote] = useState(0)
  const [commentText, setCommentText] = useState("")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(-1)
  const [isVoting, setIsVoting] = useState(false)
  const [currentScore, setCurrentScore] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)


  useEffect(() => {
    if (!report) return
    setVote(report.user_vote ?? 0)
    setCurrentScore(report.upvote_score ?? 0)
    setSelectedQuote(null)
    setHighlightRects([])
    setSelectionTooltip(null)
    pendingQuoteRef.current = ""
  }, [report])

  useEffect(() => {
    if (!report?.series_id) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key === "ArrowLeft" && report.prev_slug) navigate(`/report/${report.prev_slug}`)
      if (e.key === "ArrowRight" && report.next_slug) navigate(`/report/${report.next_slug}`)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [report?.series_id, report?.prev_slug, report?.next_slug, navigate])

  // Text selection → highlight overlays + floating "Comment" tooltip.
  // Reads getClientRects() from the selection Range and renders React-owned
  // overlay divs. Supports drag-select, double-click, and triple-click.
  useEffect(() => {
    const wrapper = reportWrapperRef.current
    if (!wrapper || !isAuthenticated || isFullscreen) return

    /** Read the current selection and compute overlay rects + tooltip pos.
     *  Returns null if there's no usable selection inside the wrapper. */
    const readSelection = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim()
      if (!text || text.length < 2 || !sel || sel.rangeCount === 0) return null

      const range = sel.getRangeAt(0)
      if (!wrapper.contains(range.commonAncestorContainer)) return null

      const wrapperRect = wrapper.getBoundingClientRect()
      const clientRects = range.getClientRects()
      const rects: { top: number; left: number; width: number; height: number }[] = []
      for (let i = 0; i < clientRects.length; i++) {
        const r = clientRects[i]
        if (r.width < 1) continue
        rects.push({
          top: r.top - wrapperRect.top,
          left: r.left - wrapperRect.left,
          width: r.width,
          height: r.height,
        })
      }
      if (rects.length === 0) return null

      const firstRect = clientRects[0]
      return {
        text: text.slice(0, 500),
        rects,
        tooltip: { top: firstRect.top - wrapperRect.top - 44, left: firstRect.left - wrapperRect.left + firstRect.width / 2 },
      }
    }

    const applySelection = (result: NonNullable<ReturnType<typeof readSelection>>) => {
      pendingQuoteRef.current = result.text
      setHighlightRects(result.rects)
      setSelectionTooltip(result.tooltip)
    }

    const clearIfNoQuote = () => {
      setSelectionTooltip(null)
      pendingQuoteRef.current = ""
      if (!selectedQuoteRef.current) setHighlightRects([])
    }

    const handleSelectionAttempt = () => {
      // Try reading immediately — works for most selections
      const result = readSelection()
      if (result) {
        applySelection(result)
        return
      }
      // Retry once after a tick — catches fast drags & double-clicks
      // where the browser hasn't finalised the selection at mouseup time
      setTimeout(() => {
        const retry = readSelection()
        if (retry) applySelection(retry)
        else clearIfNoQuote()
      }, 10)
    }

    const handleMouseUp = (e: MouseEvent) => {
      // Don't interfere with text selection in fullscreen mode
      if (!wrapper.contains(e.target as Node)) return
      const target = e.target as HTMLElement
      if (target.closest("[data-selection-tooltip]")) return
      if (tooltipClickedRef.current) {
        tooltipClickedRef.current = false
        return
      }
      handleSelectionAttempt()
    }

    const handleMouseDown = (e: MouseEvent) => {
      // Don't interfere with text selection in fullscreen mode
      if (!wrapper.contains(e.target as Node)) return
      const target = e.target as HTMLElement
      if (target.closest("[data-selection-tooltip]")) return
      // Only clear tooltip; keep highlight rects until the next selection
      // resolves (prevents flicker during double/triple-click sequences)
      setSelectionTooltip(null)
    }

    // Double-click selects a word — handle it explicitly since the
    // mouseup in a dblclick sequence fires before the word is selected.
    const handleDblClick = () => {
      setTimeout(() => {
        const result = readSelection()
        if (result) applySelection(result)
      }, 0)
    }

    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("mousedown", handleMouseDown)
    wrapper.addEventListener("dblclick", handleDblClick)
    return () => {
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("mousedown", handleMouseDown)
      wrapper.removeEventListener("dblclick", handleDblClick)
    }
  }, [report?.html_body, isAuthenticated, isFullscreen])

  const SUGGESTED_USERS = ["Alex PM", "Sara Engineer", "Admin", "ResearchBot"]
  const filteredMentions = SUGGESTED_USERS.filter(u => u.toLowerCase().includes(mentionQuery.toLowerCase()))

  const handleToggleFullscreen = (val: boolean) => {
    setIsFullscreen(val)
    if (val) {
      // Clear selection highlight and comment tooltip when entering fullscreen
      setSelectionTooltip(null)
      setHighlightRects([])
      setSelectedQuote(null)
      pendingQuoteRef.current = ""
      window.getSelection()?.removeAllRanges()
    }
  }

  const handleVote = async (direction: 1 | -1) => {
    if (!isAuthenticated || !report || isVoting) return
    const prevVote = vote
    const prevScore = currentScore ?? report.upvote_score ?? 0
    // Optimistic update
    const newVote = vote === direction ? 0 : direction
    setVote(newVote)
    setCurrentScore(prevScore + newVote - prevVote)
    setIsVoting(true)
    try {
      const endpoint = direction === 1 ? "upvote" : "downvote"
      const res = await api.post(`/reports/${report.id}/${endpoint}`)
      setVote(res.data.user_vote ?? newVote)
      setCurrentScore(res.data.total_score ?? prevScore + newVote - prevVote)
    } catch (err) {
      // Roll back on error
      setVote(prevVote)
      setCurrentScore(prevScore)
      console.error("Vote failed", err)
    } finally {
      setIsVoting(false)
    }
  }

  if (loadingReport) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <span className="text-sm font-medium text-muted-foreground">Loading report</span>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center space-y-3">
          <div className="font-mono text-5xl font-bold text-muted-foreground/20">404</div>
          <h2 className="text-xl font-semibold text-foreground">Report not found</h2>
          <p className="text-sm text-muted-foreground">This report doesn't exist or has been removed.</p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !report) return
    try {
      await api.post(`/reports/${report.id}/comments`, {
        text: commentText.trim(),
        ...(selectedQuote ? { quoted_text: selectedQuote } : {}),
      })
      setCommentText("")
      setSelectedQuote(null)
      setHighlightRects([])
      await queryClient.invalidateQueries({ queryKey: ["comments", report.id] })
      await queryClient.invalidateQueries({ queryKey: ["report", slug] })
    } catch (err) {
      console.error(err)
    }
  }

  const handleSelectMention = (userName: string) => {
    const words = commentText.split(/\s/)
    words[words.length - 1] = `@${userName.replace(/\s+/g, "")}`
    setCommentText(words.join(" ") + " ")
    setShowMentions(false)
    setMentionIndex(-1)
  }

  const score = currentScore ?? report.upvote_score ?? 0

  return (
    <div className="flex-1 overflow-auto bg-background">
      {/* Floating agent chat bubble (bottom-right) */}
      {report.chat_enabled && (
        <ReportAgentChat
          report={report}
          chatEnabled={report.chat_enabled}
        />
      )}

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 overflow-x-hidden">

        {/* Series Navigation */}
        {report.series_id && (
          <div className="mb-6 flex items-center gap-3 rounded-sm border border-border/60 bg-muted/20 px-3 py-2">
            <span className="text-sm font-medium text-muted-foreground shrink-0">Series</span>
            <code className="font-mono text-xs font-semibold text-foreground bg-card border border-border/60 rounded px-1.5 py-0.5 shrink-0">
              {report.series_id}
            </code>
            <div className="w-px h-3.5 bg-border/50 shrink-0" />

            {report.prev_slug ? (
              <Link to={`/report/${report.prev_slug}`}>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 gap-0.5 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="size-3" />
                  <span className="tabular-nums font-mono">#{(report.run_number ?? 1) - 1}</span>
                </Button>
              </Link>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 px-1.5 opacity-25" disabled>
                <ChevronLeft className="size-3" />
              </Button>
            )}

            <div className="flex items-center gap-1 flex-1 justify-center">
              {report.series_total && report.series_total <= 12 ? (
                <div className="flex items-center gap-1">
                  {Array.from({ length: report.series_total }, (_, i) => {
                    const runIdx = i + 1
                    const isCurrent = runIdx === report.run_number
                    const isPast = runIdx < (report.run_number ?? 0)
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-full transition-all duration-300",
                          isCurrent ? "w-4 h-1.5 bg-primary" :
                          isPast    ? "w-1.5 h-1.5 bg-primary/50" :
                                      "w-1.5 h-1.5 bg-border"
                        )}
                      />
                    )
                  })}
                </div>
              ) : (
                <span className="font-mono text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{report.run_number ?? "?"}</span>
                  {" / "}{report.series_total ?? "?"}
                </span>
              )}
            </div>

            {report.next_slug ? (
              <Link to={`/report/${report.next_slug}`}>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 gap-0.5 text-xs text-muted-foreground hover:text-foreground">
                  <span className="tabular-nums font-mono">#{(report.run_number ?? 0) + 1}</span>
                  <ChevronRight className="size-3" />
                </Button>
              </Link>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 px-1.5 opacity-25" disabled>
                <ChevronRight className="size-3" />
              </Button>
            )}
          </div>
        )}

        {/* ─── Editorial Header ─── */}
        <header className="mb-5 pb-5 border-b border-border/60">
          {/* Byline */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mb-3">
            <Link
              to={`/space/${(report.space || report.space_name || "").replace("o/", "")}`}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {report.space || report.space_name}
            </Link>
            <span className="text-border" aria-hidden>·</span>
            <Badge
              variant="secondary"
              className="h-4 px-1.5 py-0 text-sm font-medium text-muted-foreground bg-primary/10 text-primary border-primary/20"
            >
              {report.content_type === "slideshow" ? "Presentation" : "Report"}
            </Badge>
            <span className="text-border" aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <Bot className="size-3 text-muted-foreground/60" />
              <Link
                to={`/assistant/${report.agent || report.agent_name}`}
                className="font-medium hover:text-foreground transition-colors"
              >
                {report.agent || report.agent_name}
              </Link>
            </span>
            <span className="text-border" aria-hidden>·</span>
            <time className="tabular-nums">
              {report.time || new Date(report.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </time>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight mb-3">
            {report.title}
          </h1>

          {/* Tags */}
          {report.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {report.tags.map((tag) => (
                <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}>
                  <Badge variant="secondary" className="font-normal text-xs bg-muted hover:bg-secondary text-muted-foreground transition-colors cursor-pointer">
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </header>

        {/* ─── Action Bar ─── */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-7">
          {/* Grouped vote control */}
          <div className="flex items-center rounded-md border border-border/70 bg-card overflow-hidden shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              disabled={!isAuthenticated || isVoting}
              onClick={() => handleVote(1)}
              className={cn(
                "h-8 px-2.5 rounded-none border-r border-border/60 transition-colors",
                vote === 1
                  ? "text-primary bg-primary/10 hover:bg-primary/15"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              )}
            >
              <ArrowBigUp className={cn("size-4", vote === 1 && "fill-primary")} />
            </Button>
            <span className={cn(
              "px-2.5 min-w-[2.25rem] text-center font-mono text-sm font-bold tabular-nums",
              vote === 1 ? "text-primary" : vote === -1 ? "text-signal" : "text-foreground"
            )}>
              {score}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!isAuthenticated || isVoting}
              onClick={() => handleVote(-1)}
              className={cn(
                "h-8 px-2.5 rounded-none border-l border-border/60 transition-colors",
                vote === -1
                  ? "text-signal bg-signal/10 hover:bg-signal/15"
                  : "text-muted-foreground hover:text-signal hover:bg-signal/10"
              )}
            >
              <ArrowBigDown className={cn("size-4", vote === -1 && "fill-signal")} />
            </Button>
          </div>

          {/* Secondary actions */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => handleToggleFullscreen(true)}
          >
            <Maximize2 className="size-3.5" />
            <span className="hidden sm:inline text-xs">Expand</span>
          </Button>

          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSaving}
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
              onClick={async () => {
                setIsSaving(true)
                setSaveMessage("")
                try {
                  await api.post("/auth/me/favorites", { target_type: "report", target_id: report.id, label: report.title })
                  window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                  setSaveMessage("Saved")
                } catch (err) {
                  console.error("Save failed", err)
                  setSaveMessage("Failed")
                } finally {
                  setIsSaving(false)
                }
              }}
            >
              <Bookmark className="size-3.5" />
              <span className="hidden sm:inline text-xs">Save</span>
            </Button>
          )}

          {isAuthenticated && report.can_delete && (
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              className="h-8 gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40"
              onClick={async () => {
                if (!confirm("Delete this report permanently? This action cannot be undone.")) return
                setIsDeleting(true)
                try {
                  await api.delete(`/reports/${report.id}`)
                  await queryClient.invalidateQueries({ queryKey: ["reports"] })
                  await queryClient.invalidateQueries({ queryKey: ["spaces"] })
                  window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                  navigate(report.space_name ? `/space/${report.space_name.replace("o/", "")}` : "/")
                } catch (err) {
                  console.error("Delete failed", err)
                } finally {
                  setIsDeleting(false)
                }
              }}
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline text-xs">Delete</span>
            </Button>
          )}

          {saveMessage && (
            <span className="text-sm font-medium text-muted-foreground animate-in fade-in duration-200">
              {saveMessage}
            </span>
          )}

          {/* Comment count */}
          <div className="ml-auto flex items-center gap-1.5 text-muted-foreground">
            <MessageSquare className="size-3.5" />
            <span className="font-mono text-xs tabular-nums">{comments.length}</span>
            <span className="hidden sm:inline text-xs">comments</span>
          </div>
        </div>

        {/* ─── Fullscreen Overlay ─── */}
        {isFullscreen && (
          report.content_type === "slideshow" ? (
            <div className="fixed inset-0 z-[100] bg-foreground/90 backdrop-blur-sm overflow-hidden animate-in fade-in duration-300">
              <div className="fixed top-4 right-4 z-[110]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleFullscreen(false)}
                  className="bg-card/90 backdrop-blur shadow-md gap-2 text-foreground hover:text-foreground"
                >
                  <Minimize2 className="size-4" /> Exit Fullscreen
                </Button>
              </div>
              <SlideshowViewer
                htmlBody={report.html_body || ""}
                isFullscreen={true}
                onRequestExitFullscreen={() => handleToggleFullscreen(false)}
              />
            </div>
          ) : (
            <div className="fixed inset-0 z-[100] bg-foreground/90 backdrop-blur-sm overflow-y-auto p-4 md:p-12 animate-in fade-in duration-300">
              <div className="fixed top-4 right-4 z-[110]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleFullscreen(false)}
                  className="bg-card/90 backdrop-blur shadow-md gap-2 text-foreground hover:text-foreground"
                >
                  <Minimize2 className="size-4" /> Exit Fullscreen
                </Button>
              </div>
              <Card className="mx-auto shadow-2xl border-border overflow-hidden max-w-7xl relative animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 my-0">
                <CardContent className="!p-0 overflow-x-auto">
                  <div
                    className="max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_pre]:overflow-x-auto"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(report.html_body || "", REPORT_SANITIZE_CONFIG),
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          )
        )}

        {/* ─── Select-to-quote hint ─── */}
        {isAuthenticated && showSelectHint && report.content_type !== "slideshow" && (
          <div className="mb-3 flex items-center gap-2.5 px-3 py-2 rounded-sm bg-primary/[0.04] border border-primary/10 animate-in fade-in slide-in-from-top-1 duration-500">
            <Highlighter className="size-3.5 text-primary/50 shrink-0" />
            <span className="text-[12px] text-muted-foreground">
              <span className="font-medium text-foreground/70">Select text</span> in the report to quote it in a comment
            </span>
            <button
              onClick={() => {
                setShowSelectHint(false)
                try { localStorage.setItem("or-select-hint-dismissed", "1") } catch {}
              }}
              className="ml-auto shrink-0 p-0.5 rounded text-muted-foreground/30 hover:text-foreground/60 transition-colors"
              aria-label="Dismiss hint"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {/* ─── Document Body ─── */}
        <div className="mb-10 rounded-lg border border-border/60 overflow-hidden shadow-sm">
          {/* Content */}
          <div>
            {report.content_type === "slideshow" ? (
              <SlideshowViewer htmlBody={report.html_body || ""} />
            ) : (
              <div ref={reportWrapperRef} className="relative">
                <div
                  className="max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_pre]:overflow-x-auto [&_iframe]:max-w-full"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(report.html_body || "", REPORT_SANITIZE_CONFIG),
                  }}
                />
                {/* Highlight overlays — React-owned, positioned over selected text */}
                {highlightRects.map((r, i) => (
                  <div
                    key={i}
                    className="absolute pointer-events-none rounded-[2px]"
                    style={{
                      top: r.top,
                      left: r.left,
                      width: r.width,
                      height: r.height,
                      background: "linear-gradient(120deg, rgba(250,204,21,0.22) 0%, rgba(250,204,21,0.38) 100%)",
                    }}
                  />
                ))}

                {/* ── Selection tooltip — absolute inside wrapper, same coordinate space as highlights ── */}
                {selectionTooltip && (
                  <div
                    data-selection-tooltip
                    className="absolute z-[200] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
                    style={{
                      top: selectionTooltip.top,
                      left: selectionTooltip.left,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <button
                      className={cn(
                        "pointer-events-auto relative flex items-center gap-1.5",
                        "pl-2.5 pr-3 py-1.5 rounded-full",
                        "bg-foreground text-background text-[11px] font-semibold tracking-wide",
                        "shadow-[0_4px_20px_rgba(0,0,0,0.25)] ring-1 ring-white/10",
                        "hover:scale-105 active:scale-95 transition-transform duration-100",
                        "after:absolute after:left-1/2 after:-translate-x-1/2 after:top-full",
                        "after:border-[5px] after:border-transparent after:border-t-foreground",
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        tooltipClickedRef.current = true
                        const quote = pendingQuoteRef.current
                        if (quote) {
                          setSelectedQuote(quote)
                          setSelectionTooltip(null)
                          pendingQuoteRef.current = ""
                          setTimeout(() => {
                            discussionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                            setTimeout(() => commentTextareaRef.current?.focus(), 400)
                          }, 50)
                        }
                      }}
                    >
                      <MessageSquare className="size-3 opacity-70" />
                      Comment
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Discussion ─── */}
        <section ref={discussionRef} className="pb-16 scroll-mt-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="text-sm font-medium text-muted-foreground">Discussion</span>
            <span className="font-mono text-[10px] text-muted-foreground bg-muted rounded-sm px-1.5 py-0.5 tabular-nums">
              {comments.length}
            </span>
          </div>

          {/* Comment input */}
          <div className="mb-6 relative">
            {isAuthenticated ? (
              <div className="flex gap-3">
                <Avatar className="size-7 shrink-0 mt-1">
                  {user?.avatar && <AvatarImage src={user.avatar} alt={user?.name || "You"} className="object-cover" />}
                  <AvatarFallback className={cn("text-[10px]", getAvatarColor(user?.name || user?.id))}>
                    {user?.name ? getInitials(user.name) : <Bot className="size-3" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="rounded-sm border border-border bg-card overflow-hidden focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary/50 transition-all">
                    {/* Quoted text preview */}
                    {selectedQuote && (
                      <div className="mx-3 mt-3 mb-1 flex items-start gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="flex-1 min-w-0 relative border-l-[3px] border-primary/50 pl-3 py-1.5 rounded-r-md bg-gradient-to-r from-primary/[0.06] to-transparent">
                          <p className="text-[13px] text-foreground/70 italic leading-relaxed line-clamp-3">
                            {selectedQuote.length > 150 ? selectedQuote.slice(0, 150) + "\u2026" : selectedQuote}
                          </p>
                        </div>
                        <button
                          onClick={() => { setSelectedQuote(null); setHighlightRects([]) }}
                          className="shrink-0 mt-1 p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/80 transition-all duration-150"
                          aria-label="Remove quote"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )}
                    <textarea
                      ref={commentTextareaRef}
                      value={commentText}
                      onChange={(e) => {
                        const val = e.target.value
                        setCommentText(val)
                        const words = val.split(/\s/)
                        const lastWord = words[words.length - 1]
                        if (lastWord.startsWith("@")) {
                          setMentionQuery(lastWord.slice(1))
                          setShowMentions(true)
                        } else {
                          setShowMentions(false)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          if (showMentions && filteredMentions.length > 0) {
                            e.preventDefault()
                            handleSelectMention(filteredMentions[mentionIndex === -1 ? 0 : mentionIndex])
                          } else {
                            e.preventDefault()
                            handleSubmitComment()
                          }
                          return
                        }
                        if (showMentions && filteredMentions.length > 0) {
                          if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(p => (p + 1) % filteredMentions.length) }
                          else if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(p => (p - 1 + filteredMentions.length) % filteredMentions.length) }
                          else if (e.key === "Tab") { e.preventDefault(); handleSelectMention(filteredMentions[mentionIndex === -1 ? 0 : mentionIndex]) }
                          else if (e.key === "Escape") { setShowMentions(false) }
                        }
                      }}
                      placeholder="Add to the discussion… use @ to mention someone"
                      className="w-full min-h-[84px] bg-transparent border-0 p-3 text-sm resize-none focus:outline-none placeholder:text-muted-foreground/40"
                    />
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border/60 bg-muted/20">
                      <span className="text-sm font-medium text-muted-foreground/40 hidden sm:block">
                        Enter to submit · Shift+Enter for newline
                      </span>
                      <Button
                        size="sm"
                        className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 ml-auto"
                        onClick={handleSubmitComment}
                        disabled={!commentText.trim()}
                      >
                        <Send className="size-3" /> Post
                      </Button>
                    </div>
                  </div>

                  {/* Mention dropdown */}
                  {showMentions && filteredMentions.length > 0 && (
                    <div className="absolute left-0 w-52 mt-1 rounded-sm shadow-2xl z-[100] overflow-hidden bg-card border border-border animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="p-1.5">
                        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b border-border/60 mb-1">
                          Tag someone
                        </div>
                        {filteredMentions.map((userName, i) => (
                          <button
                            key={userName}
                            className={cn(
                              "w-full text-left px-2.5 py-2 text-sm rounded-md transition-colors flex items-center gap-2",
                              i === mentionIndex ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-foreground"
                            )}
                            onMouseDown={(e) => { e.preventDefault(); handleSelectMention(userName) }}
                          >
                            <div className="size-6 rounded-full bg-primary/15 flex items-center justify-center font-mono text-[10px] text-primary font-bold shrink-0">
                              {userName.split(" ").map(n => n[0]).join("")}
                            </div>
                            {userName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-sm border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>{" "}
                to comment and vote on reports.
              </div>
            )}
          </div>

          {/* Comment list */}
          {comments.length > 0 && (
            <div className="divide-y divide-border/40">
              {comments.map((comment, idx) => (
                <div
                  key={comment.id}
                  className="feed-item-enter transition-colors"
                  style={{ animationDelay: `${Math.min(idx * 60, 480)}ms` }}
                >
                  <CommentItem comment={comment} reportId={report.id} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

    </div>
  )
}

function CommentItem({ comment, reportId }: { comment: ReportComment; reportId: string }) {
  const { isAuthenticated } = useAuth()
  const [reactions, setReactions] = useState<{ emoji: string; count: number; reacted: boolean }[]>(
    Array.isArray(comment.reactions) ? comment.reactions : [],
  )
  const [isReacting, setIsReacting] = useState<string | null>(null)

  useEffect(() => {
    setReactions(Array.isArray(comment.reactions) ? comment.reactions : [])
  }, [comment.id, comment.reactions])

  const toggleReaction = async (emoji: string) => {
    if (!isAuthenticated || isReacting) return
    setIsReacting(emoji)
    setReactions((prev) => {
      const existing = prev.find((r) => r.emoji === emoji)
      if (existing) {
        return prev.map((r) =>
          r.emoji === emoji
            ? { ...r, reacted: !r.reacted, count: r.reacted ? Math.max(0, r.count - 1) : r.count + 1 }
            : r,
        )
      }
      return [...prev, { emoji, count: 1, reacted: true }]
    })
    try {
      await api.post(`/reports/${reportId}/comments/${comment.id}/reactions`, { emoji })
    } catch (err) {
      console.error("Reaction update failed", err)
      setReactions(Array.isArray(comment.reactions) ? comment.reactions : [])
    } finally {
      setIsReacting(null)
    }
  }

  return (
    <div className="flex gap-3 py-4 group">
      <Avatar className="size-7 shrink-0 mt-0.5">
        {comment.author_avatar && <AvatarImage src={comment.author_avatar} alt={comment.author_name} className="object-cover" />}
        <AvatarFallback className={cn("text-[10px]", getAvatarColor(comment.author_name || comment.author?.name || comment.id))}>
          {getInitials(comment.author_name || comment.author?.name || "Unknown")}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-foreground">{comment.author_name}</span>
          <time className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
            {timeAgo(comment.created_at)}
          </time>
        </div>
        {comment.quoted_text && (
          <QuotedTextBlock text={comment.quoted_text} />
        )}
        <MentionedText text={comment.text} className="text-sm text-foreground/90 leading-relaxed" />

        {/* Reactions */}
        <div className="flex items-center gap-1.5 mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {reactions.map(r => (
            <Button
              key={r.emoji}
              variant="outline"
              size="sm"
              disabled={!isAuthenticated || !!isReacting}
              className={cn(
                "h-6 px-1.5 rounded-full gap-1 text-[11px] transition-all",
                r.reacted
                  ? "bg-primary/10 border-primary/25 text-primary hover:bg-primary/15"
                  : "hover:bg-muted text-muted-foreground border-border/60"
              )}
              onClick={() => void toggleReaction(r.emoji)}
            >
              <span>{r.emoji}</span>
              {r.count > 0 && <span className="font-mono font-bold">{r.count}</span>}
            </Button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!isAuthenticated || !!isReacting}
                className="size-6 rounded-full text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
              >
                <Smile className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="grid grid-cols-3 gap-1 p-2 shadow-2xl border-border bg-card/95 backdrop-blur-sm min-w-[124px] animate-in zoom-in-95 duration-150"
            >
              <div className="col-span-3 px-1 py-1 text-sm font-medium text-muted-foreground text-center border-b border-border/60 mb-1">
                React
              </div>
              {["👍", "❤️", "🚀", "💡", "💯", "✅", "🔥", "👀", "🤔"].map(emoji => (
                <DropdownMenuItem
                  key={emoji}
                  className="p-0 focus:bg-transparent rounded-md overflow-hidden"
                  onSelect={(e) => { e.preventDefault(); void toggleReaction(emoji) }}
                >
                  <Button variant="ghost" size="icon" className="size-9 text-xl hover:bg-muted transition-colors">
                    {emoji}
                  </Button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

function QuotedTextBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 200

  return (
    <blockquote className="mb-2.5 border-l-[3px] border-primary/30 pl-3 py-1.5 rounded-r-md bg-gradient-to-r from-primary/[0.04] to-transparent">
      <p className={cn(
        "text-[13px] text-foreground/60 italic leading-relaxed",
        !expanded && isLong && "line-clamp-2"
      )}>
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-primary/60 hover:text-primary font-semibold mt-1 tracking-wide uppercase transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </blockquote>
  )
}
