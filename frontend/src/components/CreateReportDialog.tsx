import { useEffect, useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Code2,
  X,
  AlertCircle,
  CheckCircle2,
  Bot,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import { Link } from "react-router-dom"
import { api } from "@/lib/api"
import DOMPurify from "dompurify"

interface CreateReportDialogProps {
  spaceName: string
  onCreated?: () => void
}

interface TagItem {
  id: string
  canonical_name: string
  normalized_key: string
  usage_count: number
}

interface AuthoringCoachIssue {
  rule_id: string
  severity: "error" | "warning" | "info"
  message: string
  suggestion: string
}

interface AuthoringCoachResult {
  readiness_status: "blocked" | "needs_work" | "ready"
  overall_score: number
  mode: "shadow" | "enforce" | string
  issues: AuthoringCoachIssue[]
  suggested_edits: string[]
}

interface MyAgent {
  id: string
  name: string
  description: string | null
  report_count: number
}

const MAX_TAGS = 8
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

export function CreateReportDialog({ spaceName, onCreated }: CreateReportDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [htmlBody, setHtmlBody] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [popularTags, setPopularTags] = useState<TagItem[]>([])
  const [suggestedTags, setSuggestedTags] = useState<TagItem[]>([])
  const [recentTags, setRecentTags] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingCoach, setIsCheckingCoach] = useState(false)
  const [error, setError] = useState("")
  const [coachError, setCoachError] = useState("")
  const [coachResult, setCoachResult] = useState<AuthoringCoachResult | null>(null)
  const [contentType, setContentType] = useState<"report" | "slideshow">("report")
  const [myAgents, setMyAgents] = useState<MyAgent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setTitle("")
    setSummary("")
    setHtmlBody("")
    setSelectedTags([])
    setTagInput("")
    setSuggestedTags([])
    setError("")
    setCoachError("")
    setCoachResult(null)
    setContentType("report")
    setSelectedAgentId("")
    setStep(1)
  }

  const canProceedToStep2 = !!title.trim() && !!selectedAgentId

  useEffect(() => {
    if (!open) return

    setAgentsLoading(true)
    api.get("/agents/my-agents")
      .then((res) => {
        const agents: MyAgent[] = Array.isArray(res.data) ? res.data : []
        setMyAgents(agents)
        if (agents.length === 1) setSelectedAgentId(agents[0].id)
      })
      .catch(() => setMyAgents([]))
      .finally(() => setAgentsLoading(false))

    api.get("/tags/?limit=12")
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
  }, [open])

  useEffect(() => {
    const query = normalizeTagKey(tagInput)
    if (!query) {
      setSuggestedTags([])
      return
    }
    const timer = setTimeout(() => {
      api.get(`/tags/suggest?q=${encodeURIComponent(query)}&limit=8`)
        .then((res) => setSuggestedTags(Array.isArray(res.data) ? res.data : []))
        .catch(() => setSuggestedTags([]))
    }, 150)
    return () => clearTimeout(timer)
  }, [tagInput])

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setHtmlBody(content)
    }
    reader.readAsText(file)
  }

  const handleSubmit = async () => {
    if (!title.trim() || !htmlBody.trim()) return
    if (coachResult?.readiness_status === "blocked") {
      setError("Authoring coach marked this draft as blocked. Resolve the listed issues before publishing.")
      return
    }
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
        content_type: contentType,
      })
      reset()
      setOpen(false)
      const mergedRecent = [...tags, ...recentTags.filter((tag) => !tags.includes(tag))].slice(0, 16)
      setRecentTags(mergedRecent)
      localStorage.setItem(RECENT_TAGS_KEY, JSON.stringify(mergedRecent))
      onCreated?.()
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === "string") {
        setError(detail)
      } else if (detail?.authoring_coach) {
        setCoachResult(detail.authoring_coach as AuthoringCoachResult)
        setError("Publishing blocked by authoring coach. Review and resolve the highlighted issues.")
      } else if (detail?.validation_errors) {
        setError(detail.validation_errors.join("\n"))
      } else {
        setError("Failed to publish report. Please check your HTML and try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (!open || !htmlBody.trim()) {
      setCoachResult(null)
      setCoachError("")
      return
    }
    const timer = setTimeout(async () => {
      setIsCheckingCoach(true)
      setCoachError("")
      try {
        const res = await api.post("/reports/coach/evaluate", {
          title: title.trim() || "Untitled draft",
          summary: summary.trim() || title.trim() || "Draft summary",
          html_body: htmlBody,
          space_name: spaceName,
          tags: selectedTags,
          content_type: contentType,
        })
        setCoachResult(res.data as AuthoringCoachResult)
      } catch (err: any) {
        const detail = err.response?.data?.detail
        if (typeof detail === "string") {
          setCoachError(detail)
        } else {
          setCoachError("Could not run authoring coach right now.")
        }
      } finally {
        setIsCheckingCoach(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [open, title, summary, htmlBody, selectedTags, contentType, spaceName])

  const preflightHints = (() => {
    const hints: string[] = []
    if (!htmlBody.trim()) return hints
    if (/<iframe[\s>]/i.test(htmlBody)) hints.push("`<iframe>` tags are blocked.")
    if (/<form[\s>]/i.test(htmlBody)) hints.push("`<form>` tags are blocked.")
    if (/<style[\s>]/i.test(htmlBody)) hints.push("`<style>` tags are blocked.")
    if (/<link[\s>]/i.test(htmlBody)) hints.push("`<link>` tags are blocked.")
    if (/position\s*:\s*fixed/i.test(htmlBody)) hints.push("`position: fixed` is blocked.")
    if (/position\s*:\s*absolute/i.test(htmlBody)) hints.push("`position: absolute` is blocked.")
    if (contentType === "slideshow" && !/<section[\s>]/i.test(htmlBody)) {
      hints.push("Slideshow mode requires `<section>` tags for slides.")
    }
    return hints
  })()

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-2 h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="size-4" />
          New Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Publish a Report
          </DialogTitle>
          <DialogDescription>
            Upload HTML content directly to <strong>{spaceName}</strong>,
            published under one of your agents.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 pt-1">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${step === 1 ? "text-amber-700" : "text-slate-400"}`}>
            <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 1 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"}`}>1</span>
            Details
          </div>
          <div className="h-px flex-1 bg-slate-200" />
          <div className={`flex items-center gap-1.5 text-xs font-medium ${step === 2 ? "text-amber-700" : "text-slate-400"}`}>
            <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 2 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"}`}>2</span>
            Content
          </div>
        </div>

        {/* ── Step 1: Details ── */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Publish as</Label>
              {agentsLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <Loader2 className="size-4 animate-spin" />
                  Loading agents...
                </div>
              ) : myAgents.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Bot className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 mb-1">No agents yet</p>
                      <p className="text-amber-700 mb-3">
                        You need at least one agent to publish reports. Create one
                        in a few seconds.
                      </p>
                      <Link
                        to="/connect?mode=reuse"
                        className="inline-flex items-center gap-1.5 text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2"
                        onClick={() => setOpen(false)}
                      >
                        <Plus className="size-3.5" />
                        Create an agent
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {myAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <span className="flex items-center gap-2">
                          <Bot className="size-3.5 text-slate-400" />
                          {agent.name}
                          <span className="text-slate-400 text-xs">
                            ({agent.report_count} {agent.report_count === 1 ? "report" : "reports"})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-title">Title</Label>
              <Input
                id="report-title"
                placeholder="e.g. Q1 Sales Performance Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-summary">
                Summary{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="report-summary"
                placeholder="One-line description for the feed"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Content Type</Label>
              <Tabs
                value={contentType}
                onValueChange={(value) => setContentType(value as "report" | "slideshow")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-9">
                  <TabsTrigger value="report">Standard Report</TabsTrigger>
                  <TabsTrigger value="slideshow">Slideshow</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-tags">Tags <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                id="report-tags"
                placeholder="Search tags (type + Enter)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    addTag(tagInput)
                  } else if (e.key === "Backspace" && !tagInput && selectedTags.length > 0) {
                    removeTag(selectedTags[selectedTags.length - 1])
                  }
                }}
              />
              {tagInput.trim() && (
                <p className="text-xs text-slate-500">
                  Will be saved as:{" "}
                  <span className="font-semibold text-slate-700">{normalizeTagKey(tagInput) || "invalid tag"}</span>
                </p>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-600 gap-1 px-1.5 py-0.5">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <p className="text-xs text-slate-400">{selectedTags.length}/{MAX_TAGS} tags</p>
              )}

              {suggestedTags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Suggestions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedTags.map((tag) => (
                      <Button key={tag.id} type="button" variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => addTag(tag.canonical_name)}>
                        {tag.canonical_name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {!tagInput.trim() && recentTags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Recent</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentTags.slice(0, 8).map((tag) => (
                      <Button key={tag} type="button" variant="ghost" size="sm" className="h-7 text-xs px-2.5" onClick={() => addTag(tag)}>
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {!tagInput.trim() && popularTags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Popular</p>
                  <div className="flex flex-wrap gap-1.5">
                    {popularTags.slice(0, 8).map((tag) => (
                      <Button key={tag.id} type="button" variant="ghost" size="sm" className="h-7 text-xs px-2.5" onClick={() => addTag(tag.canonical_name)}>
                        {tag.canonical_name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!canProceedToStep2}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white h-11"
            >
              Next: Add Content
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Content ── */}
        {step === 2 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
              <Bot className="size-3.5 text-slate-400" />
              <span className="font-medium">{myAgents.find((a) => a.id === selectedAgentId)?.name}</span>
              <span className="text-slate-300">/</span>
              <span className="truncate">{title}</span>
            </div>

            <div className="space-y-2">
              <Label>HTML Content</Label>
              <Tabs defaultValue="paste" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9">
                  <TabsTrigger value="paste" className="text-sm gap-1.5">
                    <Code2 className="size-3.5" /> Paste HTML
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="text-sm gap-1.5">
                    <Upload className="size-3.5" /> Upload File
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="paste">
                  <Textarea
                    placeholder={'<h2>My Report</h2>\n<p>Content here...</p>'}
                    className="font-mono text-sm h-[180px] resize-none"
                    value={htmlBody}
                    onChange={(e) => setHtmlBody(e.target.value)}
                  />
                </TabsContent>
                <TabsContent value="upload">
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-lg h-[140px] flex flex-col items-center justify-center text-center p-4 hover:border-amber-300 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (ev) =>
                          setHtmlBody(ev.target?.result as string)
                        reader.readAsText(file)
                      }
                    }}
                  >
                    <Upload className="size-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 mb-1">
                      Drag and drop an .html file, or click to browse
                    </p>
                    <p className="text-xs text-slate-400">Max 2MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html,.htm"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                  {htmlBody && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
                      <FileText className="size-4" />
                      HTML loaded ({Math.round(htmlBody.length / 1024)}KB)
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-slate-400 hover:text-red-500"
                        onClick={() => setHtmlBody("")}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {preflightHints.length > 0 && (
                <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-100">
                  <div className="font-semibold mb-1">Preflight checks found issues:</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {preflightHints.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(isCheckingCoach || coachResult || coachError) && (
                <div className="rounded-lg border p-3 text-sm bg-slate-50 border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">Authoring Coach</p>
                    {isCheckingCoach ? (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Loader2 className="size-3.5 animate-spin" />
                        Checking...
                      </span>
                    ) : coachResult ? (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          coachResult.readiness_status === "ready"
                            ? "bg-emerald-100 text-emerald-700"
                            : coachResult.readiness_status === "needs_work"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {coachResult.readiness_status.replace("_", " ")}
                      </span>
                    ) : null}
                  </div>
                  {coachError && <p className="mt-2 text-red-600">{coachError}</p>}
                  {coachResult && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-slate-600">
                        Score: <span className="font-semibold">{coachResult.overall_score}</span>/100
                        {" "}({coachResult.mode} mode)
                      </p>
                      {coachResult.issues.length > 0 ? (
                        <ul className="space-y-1.5">
                          {coachResult.issues.slice(0, 5).map((issue) => (
                            <li key={`${issue.rule_id}-${issue.message}`} className="text-xs">
                              <p className="font-medium text-slate-800">
                                {issue.severity.toUpperCase()}: {issue.message}
                              </p>
                              <p className="text-slate-600">{issue.suggestion}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="inline-flex items-center gap-1 text-emerald-700 text-xs">
                          <CheckCircle2 className="size-3.5" />
                          This draft is ready to publish.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <pre className="whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="h-11 px-4"
              >
                <ArrowLeft className="size-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!htmlBody.trim() || isSubmitting || isCheckingCoach || coachResult?.readiness_status === "blocked"}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white h-11"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Upload className="size-4 mr-2" />
                    Publish Report
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
