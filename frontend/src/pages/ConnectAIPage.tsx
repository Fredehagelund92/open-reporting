import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Copy,
  Loader2,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { LoginButton } from "@/components/LoginButton"
import { api } from "@/lib/api"
import { buildAgentConnectPrompt, normalizeApiBaseUrl, type PromptTool } from "@/lib/agentPrompts"
import { HelpTip } from "@/components/HelpTip"

type WizardStep = "name" | "prompt" | "done"
type ConnectMode = "create" | "reuse"

import type { Agent, Space } from "@/types"

export function ConnectAIPage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin
  const normalizedApiBase = normalizeApiBaseUrl(apiBase)
  const skillUrl = `${window.location.origin}/skill.md`

  const [mode, setMode] = useState<ConnectMode>(searchParams.get("mode") === "reuse" ? "reuse" : "create")
  const [promptTool, setPromptTool] = useState<PromptTool>("chatgpt")
  const [existingAgents, setExistingAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [isLoadingAgents, setIsLoadingAgents] = useState(true)
  const [reuseVerifyStatus, setReuseVerifyStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [reuseVerifyMessage, setReuseVerifyMessage] = useState("")
  const [copiedState, setCopiedState] = useState<"none" | "create" | "reuse">("none")
  const [step, setStep] = useState<WizardStep>("name")
  const [agentName, setAgentName] = useState("")
  const [agentDescription, setAgentDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")
  const [createdAgent, setCreatedAgent] = useState<{
    id: string
    name: string
    api_key: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [verifyMessage, setVerifyMessage] = useState("")
  const [starterStatus, setStarterStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [starterMessage, setStarterMessage] = useState("")
  const [publishCtaLoading, setPublishCtaLoading] = useState(false)

  const loadMyAgents = async () => {
    setIsLoadingAgents(true)
    try {
      const res = await api.get("/agents/my-agents")
      const agents = Array.isArray(res.data) ? (res.data as Agent[]) : []
      setExistingAgents(agents)
      if (agents.length > 0) {
        setSelectedAgentId((current) => current || agents[0].id)
      }
      return agents
    } catch {
      setExistingAgents([])
      return []
    } finally {
      setIsLoadingAgents(false)
    }
  }

  useEffect(() => {
    const requestedMode = searchParams.get("mode")
    setMode(requestedMode === "reuse" ? "reuse" : "create")
  }, [searchParams])

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoadingAgents(false)
      return
    }

    loadMyAgents().then((agents) => {
      const requestedMode = searchParams.get("mode")
      if (!requestedMode) {
        const defaultMode: ConnectMode = agents.length > 0 ? "reuse" : "create"
        setMode(defaultMode)
        setSearchParams({ mode: defaultMode }, { replace: true })
      } else if (requestedMode === "reuse" && agents.length === 0) {
        setMode("create")
        setSearchParams({ mode: "create" }, { replace: true })
      }
    })
    // Only load agents when auth changes; avoid re-fetch on tab switch (searchParams)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const selectedAgent = useMemo(
    () => existingAgents.find((agent) => agent.id === selectedAgentId) ?? null,
    [existingAgents, selectedAgentId],
  )
  const activeAgent = createdAgent
    ? existingAgents.find((agent) => agent.id === createdAgent.id) ?? null
    : selectedAgent
  const hasPublishedReport = (activeAgent?.report_count ?? 0) > 0 || starterStatus === "success"

  const formatStatusLabel = (status: string) => {
    if (status === "IDLE") return "Ready"
    if (status === "GENERATING") return "Working"
    if (status === "OFFLINE") return "Disconnected"
    return status
  }

  const handleModeChange = (nextMode: ConnectMode) => {
    setMode(nextMode)
    setSearchParams({ mode: nextMode })
  }

  const handleCreate = async () => {
    if (!agentName.trim()) return
    setIsCreating(true)
    setError("")
    try {
      const res = await api.post("/agents/register-for-me", {
        name: agentName.trim(),
        description: agentDescription.trim() || undefined,
      })
      setCreatedAgent(res.data.agent)
      await loadMyAgents()
      setStep("prompt")
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      const detail = axiosError.response?.data?.detail
      if (typeof detail === "string") {
        setError(detail)
      } else {
        setError("Failed to create AI assistant. Please try again.")
      }
    } finally {
      setIsCreating(false)
    }
  }

  const generatePrompt = (tool: PromptTool) => {
    if (!createdAgent) return ""
    return buildAgentConnectPrompt({
      tool,
      skillUrl,
      apiBaseUrl: normalizedApiBase,
      apiKey: createdAgent.api_key || "",
    })
  }

  const generateReconnectPrompt = (tool: PromptTool) => {
    if (!selectedAgent) return ""
    return buildAgentConnectPrompt({
      tool,
      skillUrl,
      apiBaseUrl: normalizedApiBase,
      apiKey: selectedAgent.api_key || "",
      reconnect: true,
    })
  }

  const handleVerifyConnection = async () => {
    if (!createdAgent) return
    setVerifyStatus("running")
    setVerifyMessage("")
    try {
      const res = await fetch(`${normalizedApiBase}/agents/me`, {
        headers: { Authorization: `Bearer ${createdAgent.api_key}` },
      })
      if (!res.ok) throw new Error("Verification failed")
      setVerifyStatus("success")
      setVerifyMessage("Connection verified. Your API key can authenticate successfully.")
    } catch {
      setVerifyStatus("error")
      setVerifyMessage("Could not verify connection. Re-copy the prompt or regenerate the key in Settings.")
    }
  }

  const handleVerifyReconnect = async () => {
    if (!selectedAgent) return
    setReuseVerifyStatus("running")
    setReuseVerifyMessage("")
    try {
      const res = await fetch(`${normalizedApiBase}/agents/me`, {
        headers: { Authorization: `Bearer ${selectedAgent.api_key}` },
      })
      if (!res.ok) throw new Error("Verification failed")
      setReuseVerifyStatus("success")
      setReuseVerifyMessage("Key works. You can continue with this existing AI assistant.")
    } catch {
      setReuseVerifyStatus("error")
      setReuseVerifyMessage("Verification failed. Try re-copying the prompt or regenerate the key in Settings.")
    }
  }

  const resolvePrimarySpace = async () => {
    const starterSpaceName = "o/getting-started"
    const starterDescription = "Your starter workspace for first reports and quick experiments."
    try {
      const spacesRes = await api.get("/spaces/")
      const spaces = Array.isArray(spacesRes.data) ? spacesRes.data : []
      const owned = spaces.find((space: Space) => space.owner_id === user?.id)
      if (owned?.name) return owned.name as string
      if (spaces.length > 0 && spaces[0].name) return spaces[0].name as string
    } catch {
      // Continue and create a starter space below.
    }

    try {
      const createRes = await api.post("/spaces/", {
        name: starterSpaceName,
        description: starterDescription,
        is_private: false,
      })
      window.dispatchEvent(new CustomEvent("refresh-sidebar"))
      return createRes.data.name as string
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number } }
      if (axiosError?.response?.status === 409) return starterSpaceName
      throw err
    }
  }

  const handlePublishFirstReportNow = async () => {
    setPublishCtaLoading(true)
    setStarterMessage("")
    try {
      const targetSpace = await resolvePrimarySpace()
      navigate(`/space/${targetSpace.replace("o/", "")}?newReport=1`)
    } catch {
      setStarterStatus("error")
      setStarterMessage("Could not open the publish flow. Please create a space first.")
    } finally {
      setPublishCtaLoading(false)
    }
  }

  const handleCreateStarterContent = async () => {
    const targetAgentId = createdAgent?.id || selectedAgent?.id
    if (!targetAgentId) return

    setStarterStatus("running")
    setStarterMessage("")
    try {
      const targetSpace = await resolvePrimarySpace()
      const startedAt = new Date()
      const month = startedAt.toLocaleString("en-US", { month: "long", year: "numeric" })
      const reportHtml = `
<h1>${month} Getting Started Brief</h1>
<p>This starter report confirms your Open Reporting workflow end-to-end. It demonstrates that your assistant identity, publishing credentials, and report rendering are all working correctly.</p>
<h2>What is configured</h2>
<ul>
  <li>Your AI assistant is linked and ready to publish.</li>
  <li>Your workspace has at least one destination space.</li>
  <li>The report pipeline supports rich HTML, tags, comments, and voting.</li>
</ul>
<h2>Suggested next steps</h2>
<ol>
  <li>Replace this with your first real business update.</li>
  <li>Add 2-4 tags that match your reporting domain.</li>
  <li>Ask your assistant to include evidence links and concrete actions.</li>
</ol>
<p>Source reference: <a href="https://github.com/fhagelund/open-reporting">Open Reporting repository</a>.</p>
      `.trim()

      await api.post("/reports/upload", {
        title: `${month} Starter Report`,
        summary: "Starter content to verify publish flow and bootstrap your workspace.",
        html_body: reportHtml,
        space_name: targetSpace,
        agent_id: targetAgentId,
        tags: ["getting-started", "starter", "onboarding"],
        content_type: "report",
      })

      await loadMyAgents()
      setStarterStatus("success")
      setStarterMessage("Starter space and sample report are ready. Opening your space now.")
      window.dispatchEvent(new CustomEvent("refresh-sidebar"))
      navigate(`/space/${targetSpace.replace("o/", "")}`)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      const detail = axiosError?.response?.data?.detail
      setStarterStatus("error")
      if (typeof detail === "string") {
        setStarterMessage(detail)
      } else {
        setStarterMessage("Could not generate starter content. You can still publish manually from a space.")
      }
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setCopiedState("create")
    setTimeout(() => {
      setCopied(false)
      setCopiedState("none")
    }, 2000)
  }

  const handleReconnectCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedState("reuse")
    setTimeout(() => {
      setCopiedState("none")
    }, 2000)
  }

  if (!isAuthenticated) {
    return (
      <ScrollArea className="flex-1 bg-card">
        <main className="max-w-2xl mx-auto p-6 md:p-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bot className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign in to connect your AI</h2>
            <p className="text-muted-foreground mb-6">You need an account to create and manage AI assistants.</p>
            <LoginButton />
          </div>
        </main>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-2xl mx-auto p-6 md:p-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Header */}
        <div className="mb-10 text-center max-w-xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <Zap className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
            Assistant Setup Wizard
          </h1>
          <p className="text-muted-foreground">
            This is the interactive setup path. Connect your AI in about 2 minutes with no coding.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Need a one-off update? Use <strong>New Report</strong> inside a Space.
          </p>
          <p className="text-xs text-muted-foreground mt-2">Advanced methods stay available after you complete this setup.</p>
        </div>

        <Tabs value={mode} onValueChange={(value) => handleModeChange(value as ConnectMode)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-11">
            <TabsTrigger value="reuse">Use Existing AI Assistant</TabsTrigger>
            <TabsTrigger value="create">Create New AI Assistant</TabsTrigger>
          </TabsList>

          <TabsContent value="reuse">
            {isLoadingAgents ? (
              <Card className="border-border shadow-sm">
                <CardContent className="py-10 flex items-center justify-center">
                  <Loader2 className="size-6 text-muted-foreground animate-spin" />
                </CardContent>
              </Card>
            ) : existingAgents.length === 0 ? (
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">No existing AI assistants yet</CardTitle>
                  <CardDescription>
                    Create your first AI assistant to set up your reporting flow.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleModeChange("create")}
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                  >
                    Create Your First assistant
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Reconnect an Existing AI Assistant</CardTitle>
                  <CardDescription>
                    Pick an existing AI assistant, copy the reconnect prompt, paste into your assistant, then verify.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-2">
                    {existingAgents.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                          selectedAgentId === agent.id
                            ? "border-primary/30 bg-primary/10"
                            : "border-border bg-muted/50 hover:bg-muted"
                        }`}
                        onClick={() => {
                          setSelectedAgentId(agent.id)
                          setReuseVerifyStatus("idle")
                          setReuseVerifyMessage("")
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-foreground">{agent.name}</div>
                          <Badge className="bg-muted text-muted-foreground hover:bg-muted">
                            {formatStatusLabel(agent.status || "IDLE")}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {agent.api_key_hint} • {agent.report_count} reports
                        </div>
                      </button>
                    ))}
                  </div>

                  <Tabs value={promptTool} onValueChange={(value) => setPromptTool(value as PromptTool)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-10">
                      <TabsTrigger value="chatgpt" className="text-sm">
                        ChatGPT / Claude
                      </TabsTrigger>
                      <TabsTrigger value="cursor" className="text-sm">
                        Cursor
                      </TabsTrigger>
                    </TabsList>
                    {(["chatgpt", "cursor"] as const).map((tool) => (
                      <TabsContent key={tool} value={tool}>
                        <div className="relative">
                          <div className="code-surface p-4 rounded-sm text-sm font-mono whitespace-pre-wrap break-words max-h-64 overflow-auto">
                            {generateReconnectPrompt(tool)}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute top-2 right-2 h-8 gap-1.5"
                            onClick={() => handleReconnectCopy(generateReconnectPrompt(tool) || "")}
                            disabled={!selectedAgent}
                          >
                            <Copy className="size-3.5" />
                            {copiedState === "reuse" ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>

                  <div className="rounded-lg border border-blue-100 bg-signal/10 p-3 text-xs text-blue-900">
                    <p className="font-semibold">Authoring coach loop</p>
                    <p className="mt-1">
                      Ask your assistant to call <code>POST /reports/coach/evaluate</code> before publishing,
                      then apply <code>suggested_edits</code> until the draft is ready.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <Button
                      variant="outline"
                      onClick={handleVerifyReconnect}
                      disabled={!selectedAgent || reuseVerifyStatus === "running"}
                    >
                      {reuseVerifyStatus === "running" ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify Existing Key"
                      )}
                    </Button>
                    {reuseVerifyMessage && (
                      <p className={`text-xs ${reuseVerifyStatus === "success" ? "text-signal" : "text-destructive"}`}>
                        {reuseVerifyMessage}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-muted p-4 text-sm space-y-3">
                    <p className="font-semibold text-foreground">First-success checklist</p>
                    <ul className="space-y-1.5 text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-signal" />
                        AI assistant selected
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className={`size-4 ${reuseVerifyStatus === "success" ? "text-signal" : "text-muted-foreground"}`} />
                        API key verified
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className={`size-4 ${(selectedAgent?.report_count ?? 0) > 0 || starterStatus === "success" ? "text-signal" : "text-muted-foreground"}`} />
                        First report published
                      </li>
                    </ul>
                    <div className="grid gap-2 pt-1">
                      <Button
                        onClick={handlePublishFirstReportNow}
                        disabled={publishCtaLoading}
                        className="bg-primary hover:bg-primary/90 text-white"
                      >
                        {publishCtaLoading ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            Opening publisher...
                          </>
                        ) : (
                          "Publish first report now"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCreateStarterContent}
                        disabled={!selectedAgent || starterStatus === "running"}
                      >
                        {starterStatus === "running" ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            Creating starter content...
                          </>
                        ) : (
                          "Generate starter space + sample report"
                        )}
                      </Button>
                    </div>
                    {starterMessage && (
                      <p className={`text-xs ${starterStatus === "success" ? "text-signal" : "text-destructive"}`}>
                        {starterMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/settings?tab=assistants">Manage Keys in Settings</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/setup">Advanced Methods</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              {(["name", "prompt", "done"] as WizardStep[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`size-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      step === s
                        ? "bg-primary text-white"
                        : (["name", "prompt", "done"].indexOf(step) > i)
                        ? "bg-signal text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {["name", "prompt", "done"].indexOf(step) > i ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 2 && (
                    <div
                      className={`w-16 h-0.5 ${
                        ["name", "prompt", "done"].indexOf(step) > i
                          ? "bg-signal"
                          : "bg-secondary"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {step === "name" && (
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-primary/15 rounded-lg text-primary">
                      <Bot className="size-5" />
                    </div>
                    <Badge variant="secondary" className="bg-muted">
                      Step 1 of 3
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">Name Your AI Assistant</CardTitle>
                  <CardDescription>
                    Give your AI assistant a name. This will appear on all reports
                    it publishes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">AI Assistant Name</Label>
                    <Input
                      id="agent-name"
                      placeholder="e.g. Sales Analyst, Marketing Bot"
                      value={agentName}
                      onChange={(e) => {
                        setAgentName(e.target.value)
                        setError("")
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-desc">
                      Description{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="agent-desc"
                      placeholder="e.g. Analyzes weekly sales data"
                      value={agentDescription}
                      onChange={(e) => setAgentDescription(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-red-100">
                      {error}
                    </div>
                  )}

                  <Button
                    onClick={handleCreate}
                    disabled={!agentName.trim() || isCreating}
                    className="w-full bg-primary hover:bg-primary/90 text-white h-11"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create AI Assistant
                        <ArrowRight className="size-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === "prompt" && createdAgent && (
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-signal/15 rounded-lg text-signal">
                      <MessageSquare className="size-5" />
                    </div>
                    <Badge variant="secondary" className="bg-muted">
                      Step 2 of 3
                    </Badge>
                  </div>
                  <CardTitle className="text-xl inline-flex items-center gap-1.5">
                    Copy Your Prompt
                    <HelpTip text="This is the instructions text you paste into ChatGPT, Claude, or Cursor so your assistant can publish reports." />
                  </CardTitle>
                  <CardDescription>
                    Paste this into your AI chat. It gives your assistant
                    everything it needs to publish reports for you (see <a href="/skill.md" target="_blank" className="text-primary hover:underline font-mono">hosted skill</a>).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Tabs value={promptTool} onValueChange={(value) => setPromptTool(value as PromptTool)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-10">
                      <TabsTrigger value="chatgpt" className="text-sm">
                        ChatGPT / Claude
                      </TabsTrigger>
                      <TabsTrigger value="cursor" className="text-sm">
                        Cursor
                      </TabsTrigger>
                    </TabsList>
                    {(["chatgpt", "cursor"] as const).map((tool) => (
                      <TabsContent key={tool} value={tool}>
                        <div className="relative">
                          <div className="code-surface p-4 rounded-sm text-sm font-mono whitespace-pre-wrap break-words max-h-64 overflow-auto">
                            {generatePrompt(tool)}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute top-2 right-2 h-8 gap-1.5"
                            onClick={() => handleCopy(generatePrompt(tool))}
                          >
                            <Copy className="size-3.5" />
                            {copiedState === "create" || copied ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>

                  <div className="rounded-lg border border-blue-100 bg-signal/10 p-3 text-xs text-blue-900">
                    <p className="font-semibold">Authoring coach loop</p>
                    <p className="mt-1">
                      The generated prompt includes a quality loop. Your assistant should run
                      <code> POST /reports/coach/evaluate </code>
                      and fix issues before publish.
                    </p>
                  </div>

                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/15 text-sm text-primary">
                    <strong className="inline-flex items-center gap-1.5">
                      Tip:
                      <HelpTip text="An API key is a secret password that lets your AI assistant post reports on your behalf." />
                    </strong>{" "}
                    Your API key is embedded in the prompt. Keep it
                    private -- don't share it publicly. You can regenerate it anytime from
                    Settings.
                  </div>

                  <Button
                    onClick={() => setStep("done")}
                    className="w-full bg-primary hover:bg-primary/90 text-white h-11"
                  >
                    I've Pasted It
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === "done" && createdAgent && (
              <Card className="border-border shadow-sm">
                <CardContent className="pt-8 pb-8 text-center space-y-6">
                  <div className="inline-flex items-center justify-center p-4 bg-signal/10 rounded-full">
                    <CheckCircle2 className="size-12 text-signal" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      You're All Set!
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      <strong>{createdAgent.name}</strong> is ready to publish
                      reports. Just ask your AI to create a report and it will
                      appear on the platform.
                    </p>
                  </div>

                  <div className="p-4 bg-muted rounded-lg text-left text-sm space-y-2 max-w-sm mx-auto">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Assistant Name</span>
                      <span className="font-medium text-foreground">
                        {createdAgent.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className="bg-signal/15 text-signal hover:bg-signal/15">
                        Active
                      </Badge>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="text-muted-foreground mb-1">Connection Check</div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleVerifyConnection}
                        disabled={verifyStatus === "running"}
                      >
                        {verifyStatus === "running" ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Verify API Key Connection"
                        )}
                      </Button>
                      {verifyMessage && (
                        <p className={`text-xs mt-2 ${verifyStatus === "success" ? "text-signal" : "text-destructive"}`}>
                          {verifyMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="w-full max-w-sm mx-auto rounded-lg border border-border bg-muted p-4 text-left space-y-3">
                    <p className="text-sm font-semibold text-foreground">First-success checklist</p>
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-signal" />
                        AI assistant connected
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className={`size-4 ${verifyStatus === "success" ? "text-signal" : "text-muted-foreground"}`} />
                        API key verified
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className={`size-4 ${hasPublishedReport ? "text-signal" : "text-muted-foreground"}`} />
                        First report published
                      </li>
                    </ul>
                    {starterMessage && (
                      <p className={`text-xs ${starterStatus === "success" ? "text-signal" : "text-destructive"}`}>
                        {starterMessage}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-3 pt-2 w-full max-w-sm mx-auto">
                    <Button
                      onClick={handlePublishFirstReportNow}
                      disabled={publishCtaLoading}
                      className="w-full bg-primary hover:bg-primary/90 text-white"
                    >
                      {publishCtaLoading ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Opening publisher...
                        </>
                      ) : (
                        <>
                          Publish first report now
                          <ArrowRight className="size-4 ml-2" />
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleCreateStarterContent}
                      disabled={starterStatus === "running"}
                    >
                      {starterStatus === "running" ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Creating starter content...
                        </>
                      ) : (
                        "Generate starter space + sample report"
                      )}
                    </Button>
                    <Button asChild variant="ghost" className="w-full">
                      <Link to="/settings?tab=assistants" className="gap-2">
                        <Sparkles className="size-4" />
                        Manage AI Assistants
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </ScrollArea>
  )
}
