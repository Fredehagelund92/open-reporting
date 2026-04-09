import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Upload,
  FileText,
  Loader2,
  X,
  AlertCircle,
  Bot,
  Eye,
} from "lucide-react"
import { Link } from "react-router-dom"
import { api } from "@/lib/api"
import IframePreview from "@/components/IframePreview"

interface CreateReportDialogProps {
  spaceName: string
  onCreated?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

interface TagItem {
  id: string
  canonical_name: string
  normalized_key: string
  usage_count: number
}

interface MyAgent {
  id: string
  name: string
  description: string | null
  report_count: number
}

const MAX_TAGS = 8
const MAX_HTML_SIZE = 2 * 1024 * 1024 // 2 MB
const RECENT_TAGS_KEY = "open-reporting:recent-tags"

function normalizeTagKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
}

function validateHtml(html: string): string | null {
  if (!html.trim()) return "HTML content is required."
  if (new Blob([html]).size > MAX_HTML_SIZE) return "HTML content exceeds the 2 MB limit."
  // Basic well-formedness check: look for an unclosed tag pattern
  const openTags = html.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?(?<!\/)\s*>/gi) ?? []
  const selfClosing = html.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?\s*\/>/gi) ?? []
  // Only flag truly broken markup — e.g. unmatched angle brackets
  const unmatchedOpen = (html.match(/</g) ?? []).length
  const unmatchedClose = (html.match(/>/g) ?? []).length
  if (Math.abs(unmatchedOpen - unmatchedClose) > openTags.length + selfClosing.length) {
    return "HTML appears malformed (mismatched angle brackets)."
  }
  return null
}

export function CreateReportDialog({
  spaceName,
  onCreated,
  open,
  onOpenChange,
  hideTrigger = false,
}: CreateReportDialogProps) {
  // Dialog state
  const [internalOpen, setInternalOpen] = useState(false)
  const dialogOpen = open ?? internalOpen
  const setDialogOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  // Form fields
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [htmlBody, setHtmlBody] = useState("")
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")

  // Data
  const [myAgents, setMyAgents] = useState<MyAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [popularTags, setPopularTags] = useState<TagItem[]>([])
  const [suggestedTags, setSuggestedTags] = useState<TagItem[]>([])
  const [recentTags, setRecentTags] = useState<string[]>([])

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Live preview (debounced)
  const [previewHtml, setPreviewHtml] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewHtml(htmlBody)
    }, 500)
    return () => clearTimeout(timer)
  }, [htmlBody])

  // Inline validation
  const validationError = useMemo(() => validateHtml(htmlBody), [htmlBody])
  // Only show validation errors once the user has typed something
  const showValidation = htmlBody.length > 0 && validationError !== null

  // Reset
  const reset = useCallback(() => {
    setTitle("")
    setSummary("")
    setHtmlBody("")
    setSelectedTags([])
    setTagInput("")
    setSuggestedTags([])
    setError("")
    setSelectedAgentId("")
    setPreviewHtml("")
    setIsDragOver(false)
  }, [])

  // Fetch agents, popular tags, recent tags on open
  useEffect(() => {
    if (!dialogOpen) return

    setAgentsLoading(true)
    api
      .get("/agents/my-agents")
      .then((res) => {
        const agents: MyAgent[] = Array.isArray(res.data) ? res.data : []
        setMyAgents(agents)
        if (agents.length === 1) setSelectedAgentId(agents[0].id)
      })
      .catch(() => setMyAgents([]))
      .finally(() => setAgentsLoading(false))

    api
      .get("/tags/?limit=12")
      .then((res) => setPopularTags(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPopularTags([]))

    const rawRecent = localStorage.getItem(RECENT_TAGS_KEY)
    if (rawRecent) {
      try {
        const parsed = JSON.parse(rawRecent)
        if (Array.isArray(parsed)) {
          setRecentTags(parsed.filter((t) => typeof t === "string"))
        }
      } catch {
        setRecentTags([])
      }
    }
  }, [dialogOpen])

  // Escape key to close overlay
  useEffect(() => {
    if (!dialogOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDialogOpen(false)
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [dialogOpen, setDialogOpen])

  // Tag suggestions (debounced)
  useEffect(() => {
    const query = normalizeTagKey(tagInput)
    if (!query) {
      setSuggestedTags([])
      return
    }
    const timer = setTimeout(() => {
      api
        .get(`/tags/suggest?q=${encodeURIComponent(query)}&limit=8`)
        .then((res) => setSuggestedTags(Array.isArray(res.data) ? res.data : []))
        .catch(() => setSuggestedTags([]))
    }, 150)
    return () => clearTimeout(timer)
  }, [tagInput])

  // Tag helpers
  const addTag = (rawTag: string) => {
    if (selectedTags.length >= MAX_TAGS) return
    const normalized = normalizeTagKey(rawTag)
    if (!normalized) return
    if (selectedTags.includes(normalized)) return
    setSelectedTags((prev) => [...prev, normalized])
    setTagInput("")
    setSuggestedTags([])
  }

  const removeTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag))
  }

  // File reading helper
  const readFile = (file: File) => {
    if (!file.name.match(/\.html?$/i)) {
      setError("Only .html or .htm files are accepted.")
      return
    }
    if (file.size > MAX_HTML_SIZE) {
      setError("File exceeds the 2 MB limit.")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setHtmlBody(content)
      setError("")
    }
    reader.readAsText(file)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  // Drag-and-drop handlers for the left panel
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  // Submit
  const canSubmit =
    !!title.trim() && !!htmlBody.trim() && !!selectedAgentId && !validationError && !isSubmitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError("")

    const tags = selectedTags

    try {
      await api.post("/reports/upload", {
        title: title.trim(),
        summary: summary.trim() || title.trim(),
        html_body: htmlBody,
        space_name: spaceName,
        agent_id: selectedAgentId,
        tags,
      })
      reset()
      setDialogOpen(false)
      const mergedRecent = [
        ...tags,
        ...recentTags.filter((tag) => !tags.includes(tag)),
      ].slice(0, 16)
      setRecentTags(mergedRecent)
      localStorage.setItem(RECENT_TAGS_KEY, JSON.stringify(mergedRecent))
      onCreated?.()
    } catch (err: unknown) {
      const axiosError = err as {
        response?: {
          data?: { detail?: string | { validation_errors?: string[] } }
        }
      }
      const detail = axiosError.response?.data?.detail
      if (typeof detail === "string") {
        setError(detail)
      } else if (detail?.validation_errors) {
        setError(detail.validation_errors.join("\n"))
      } else {
        setError("Failed to publish report. Please check your HTML and try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {!hideTrigger && (
        <Button
          size="sm"
          variant="default"
          className="gap-2 h-9 px-4"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" />
          New Report
        </Button>
      )}

      {dialogOpen && (
        <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setDialogOpen(false)
            reset()
          }
        }}
      >
        {/* Main overlay container: scales and fades in */}
        <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* ─ Top bar ─ */}
          <div className="shrink-0 h-16 border-b border-border flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">Publish a Report</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setDialogOpen(false)
                reset()
              }}
              aria-label="Close"
            >
              <X className="size-5" />
            </Button>
          </div>

          {/* Main content: sidebar + preview */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-0 min-h-0">
            {/* ── Left sidebar: form + HTML input ── */}
            <div
              className={`w-full lg:w-[360px] overflow-y-auto border-r border-border px-6 pb-6 pt-4 space-y-4 bg-background/95 ${
                isDragOver ? "bg-primary/5 ring-2 ring-inset ring-primary/30" : ""
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="space-y-4">

            {/* Agent selection */}
            <div className="space-y-2">
              <Label>Publish as</Label>
              {agentsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="size-4 animate-spin" />
                  Loading AI assistants...
                </div>
              ) : myAgents.length === 0 ? (
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Bot className="size-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-primary mb-1">
                        No AI assistants yet
                      </p>
                      <p className="text-primary mb-3">
                        You need at least one AI assistant to publish reports.
                        Create one in a few seconds.
                      </p>
                      <Link
                        to="/settings?tab=assistants"
                        className="inline-flex items-center gap-1.5 text-primary hover:text-primary font-medium underline underline-offset-2"
                        onClick={() => setDialogOpen(false)}
                      >
                        <Plus className="size-3.5" />
                        Create an AI assistant
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an AI assistant" />
                  </SelectTrigger>
                  <SelectContent>
                    {myAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <span className="flex items-center gap-2">
                          <Bot className="size-3.5 text-muted-foreground" />
                          {agent.name}
                          <span className="text-muted-foreground text-xs">
                            ({agent.report_count}{" "}
                            {agent.report_count === 1 ? "report" : "reports"})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="report-title">Title</Label>
              <Input
                id="report-title"
                placeholder="e.g. Q1 Sales Performance Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label htmlFor="report-summary">
                Summary{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="report-summary"
                placeholder="One-line description for the feed"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="report-tags">
                Tags{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="report-tags"
                placeholder="Search tags (type + Enter)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    addTag(tagInput)
                  } else if (
                    e.key === "Backspace" &&
                    !tagInput &&
                    selectedTags.length > 0
                  ) {
                    removeTag(selectedTags[selectedTags.length - 1])
                  }
                }}
              />
              {tagInput.trim() && (
                <p className="text-xs text-muted-foreground">
                  Will be saved as:{" "}
                  <span className="font-semibold text-foreground">
                    {normalizeTagKey(tagInput) || "invalid tag"}
                  </span>
                </p>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-muted text-foreground gap-1 px-1.5 py-0.5"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedTags.length}/{MAX_TAGS} tags
                </p>
              )}

              {suggestedTags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Suggestions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedTags.map((tag) => (
                      <Button
                        key={tag.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => addTag(tag.canonical_name)}
                      >
                        {tag.canonical_name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {!tagInput.trim() && recentTags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Recent</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentTags.slice(0, 8).map((tag) => (
                      <Button
                        key={tag}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => addTag(tag)}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {!tagInput.trim() && popularTags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Popular</p>
                  <div className="flex flex-wrap gap-1.5">
                    {popularTags.slice(0, 8).map((tag) => (
                      <Button
                        key={tag.id}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => addTag(tag.canonical_name)}
                      >
                        {tag.canonical_name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* HTML content input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="html-input">HTML Content</Label>
                <div className="flex items-center gap-2">
                  {htmlBody && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(new Blob([htmlBody]).size / 1024)} KB
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 px-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" />
                    Upload .html
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
              <div className="relative">
                <textarea
                  id="html-input"
                  className={`w-full h-[280px] resize-none rounded-md border bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    showValidation
                      ? "border-destructive focus-visible:ring-destructive"
                      : "border-input"
                  }`}
                  placeholder={
                    isDragOver
                      ? "Drop your .html file here..."
                      : '<h2>My Report</h2>\n<p>Paste or drop HTML here...</p>'
                  }
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                />
                {htmlBody && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setHtmlBody("")}
                    aria-label="Clear HTML content"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
              {isDragOver && (
                <p className="text-xs text-primary font-medium">
                  Drop your .html file to load it
                </p>
              )}
              {showValidation && (
                <p className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {validationError}
                </p>
              )}
            </div>

                {/* Error display */}
                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 flex gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <pre className="whitespace-pre-wrap font-sans">{error}</pre>
                  </div>
                )}

                {/* Publish button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-10 sticky bottom-0"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Upload className="size-4 mr-2" />
                      Publish
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* ── Right panel: live preview ── */}
            <div className="hidden lg:flex flex-1 overflow-hidden bg-muted/30 flex-col relative">
              {previewHtml.trim() ? (
                <IframePreview
                  html={previewHtml}
                  className="flex-1"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16 px-6">
                  <Eye className="size-10 mb-4 opacity-40" />
                  <p className="text-sm font-medium mb-1">Live Preview</p>
                  <p className="text-xs text-center max-w-[240px]">
                    Paste or drop HTML on the left and a sandboxed preview will
                    appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  )
}
