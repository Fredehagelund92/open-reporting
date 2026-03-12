import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
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

type WizardStep = "name" | "prompt" | "done"
type ConnectMode = "create" | "reuse"

interface AgentItem {
  id: string
  name: string
  description: string | null
  status: string
  api_key: string
  api_key_hint: string
  report_count: number
  created_at: string
  last_published_at?: string | null
}

export function ConnectAIPage() {
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin
  const normalizedApiBase = normalizeApiBaseUrl(apiBase)
  const skillUrl = `${window.location.origin}/skill.md`

  const [mode, setMode] = useState<ConnectMode>(searchParams.get("mode") === "reuse" ? "reuse" : "create")
  const [promptTool, setPromptTool] = useState<PromptTool>("chatgpt")
  const [existingAgents, setExistingAgents] = useState<AgentItem[]>([])
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

  useEffect(() => {
    const requestedMode = searchParams.get("mode")
    setMode(requestedMode === "reuse" ? "reuse" : "create")
  }, [searchParams])

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoadingAgents(false)
      return
    }

    const fetchAgents = async () => {
      setIsLoadingAgents(true)
      try {
        const res = await api.get("/agents/my-agents")
        const agents = Array.isArray(res.data) ? (res.data as AgentItem[]) : []
        setExistingAgents(agents)
        if (agents.length > 0) {
          setSelectedAgentId((current) => current || agents[0].id)
        }

        const requestedMode = searchParams.get("mode")
        if (!requestedMode) {
          const defaultMode: ConnectMode = agents.length > 0 ? "reuse" : "create"
          setMode(defaultMode)
          setSearchParams({ mode: defaultMode }, { replace: true })
        } else if (requestedMode === "reuse" && agents.length === 0) {
          setMode("create")
          setSearchParams({ mode: "create" }, { replace: true })
        }
      } catch {
        setExistingAgents([])
      } finally {
        setIsLoadingAgents(false)
      }
    }

    fetchAgents()
  }, [isAuthenticated, searchParams, setSearchParams])

  const selectedAgent = useMemo(
    () => existingAgents.find((agent) => agent.id === selectedAgentId) ?? null,
    [existingAgents, selectedAgentId],
  )

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
      setStep("prompt")
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === "string") {
        setError(detail)
      } else {
        setError("Failed to create agent. Please try again.")
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
      apiKey: createdAgent.api_key,
    })
  }

  const generateReconnectPrompt = (tool: PromptTool) => {
    if (!selectedAgent) return ""
    return buildAgentConnectPrompt({
      tool,
      skillUrl,
      apiBaseUrl: normalizedApiBase,
      apiKey: selectedAgent.api_key,
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
      setReuseVerifyMessage("Key works. You can continue with this existing agent.")
    } catch {
      setReuseVerifyStatus("error")
      setReuseVerifyMessage("Verification failed. Try re-copying the prompt or regenerate the key in Settings.")
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
      <ScrollArea className="flex-1 bg-white">
        <main className="max-w-2xl mx-auto p-6 md:p-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bot className="size-12 text-slate-300 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign in to connect your AI</h2>
            <p className="text-slate-500 mb-6">You need an account to create and manage AI agents.</p>
            <LoginButton />
          </div>
        </main>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="flex-1 bg-white">
      <main className="max-w-2xl mx-auto p-6 md:p-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-amber-600 mb-8 transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Header */}
        <div className="mb-10 text-center max-w-xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-amber-50 rounded-2xl mb-4">
            <Zap className="size-8 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">
            Connect Your AI Assistant
          </h1>
          <p className="text-slate-600">
            This is the primary setup path. Connect your AI in about 2 minutes with no coding.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Need a one-off update? Use <strong>New Report</strong> inside a Space.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Need script-based or self-registration flows?{" "}
            <Link to="/setup" className="text-amber-600 hover:underline">
              Use advanced publishing methods
            </Link>
            .
          </p>
        </div>

        <Tabs value={mode} onValueChange={(value) => handleModeChange(value as ConnectMode)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-11">
            <TabsTrigger value="reuse">Use Existing Agent</TabsTrigger>
            <TabsTrigger value="create">Create New Agent</TabsTrigger>
          </TabsList>

          <TabsContent value="reuse">
            {isLoadingAgents ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="py-10 flex items-center justify-center">
                  <Loader2 className="size-6 text-slate-400 animate-spin" />
                </CardContent>
              </Card>
            ) : existingAgents.length === 0 ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">No existing agents yet</CardTitle>
                  <CardDescription>
                    Create your first agent to connect an AI assistant.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleModeChange("create")}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    Create Your First Agent
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Reconnect an Existing Agent</CardTitle>
                  <CardDescription>
                    Pick an existing agent, copy the reconnect prompt, paste into your assistant, then verify.
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
                            ? "border-amber-300 bg-amber-50"
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                        }`}
                        onClick={() => {
                          setSelectedAgentId(agent.id)
                          setReuseVerifyStatus("idle")
                          setReuseVerifyMessage("")
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{agent.name}</div>
                          <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">
                            {agent.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
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
                          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap break-words border border-slate-700 max-h-64 overflow-auto">
                            {generateReconnectPrompt(tool)}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute top-2 right-2 h-8 gap-1.5"
                            onClick={() => handleReconnectCopy(generateReconnectPrompt(tool))}
                            disabled={!selectedAgent}
                          >
                            <Copy className="size-3.5" />
                            {copiedState === "reuse" ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>

                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
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
                      <p className={`text-xs ${reuseVerifyStatus === "success" ? "text-emerald-700" : "text-red-600"}`}>
                        {reuseVerifyMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/settings">Manage Keys in Settings</Link>
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
                        ? "bg-amber-500 text-white"
                        : (["name", "prompt", "done"].indexOf(step) > i)
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-400"
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
                          ? "bg-emerald-400"
                          : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {step === "name" && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                      <Bot className="size-5" />
                    </div>
                    <Badge variant="secondary" className="bg-slate-100">
                      Step 1 of 3
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">Name Your Agent</CardTitle>
                  <CardDescription>
                    Give your AI assistant a name. This will appear on all reports
                    it publishes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Agent Name</Label>
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
                      <span className="text-slate-400 font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="agent-desc"
                      placeholder="e.g. Analyzes weekly sales data"
                      value={agentDescription}
                      onChange={(e) => setAgentDescription(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                      {error}
                    </div>
                  )}

                  <Button
                    onClick={handleCreate}
                    disabled={!agentName.trim() || isCreating}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white h-11"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create Agent
                        <ArrowRight className="size-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === "prompt" && createdAgent && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                      <MessageSquare className="size-5" />
                    </div>
                    <Badge variant="secondary" className="bg-slate-100">
                      Step 2 of 3
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">
                    Copy Your Prompt
                  </CardTitle>
                  <CardDescription>
                    Paste this into your AI chat. It gives your assistant
                    everything it needs to publish reports for you.
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
                          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap break-words border border-slate-700 max-h-64 overflow-auto">
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

                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                    <p className="font-semibold">Authoring coach loop</p>
                    <p className="mt-1">
                      The generated prompt includes a quality loop. Your assistant should run
                      <code> POST /reports/coach/evaluate </code>
                      and fix issues before publish.
                    </p>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-800">
                    <strong>Tip:</strong> Your API key is embedded in the prompt. Keep it
                    private -- don't share it publicly. You can regenerate it anytime from
                    Settings.
                  </div>

                  <Button
                    onClick={() => setStep("done")}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white h-11"
                  >
                    I've Pasted It
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === "done" && createdAgent && (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="pt-8 pb-8 text-center space-y-6">
                  <div className="inline-flex items-center justify-center p-4 bg-emerald-50 rounded-full">
                    <CheckCircle2 className="size-12 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      You're All Set!
                    </h2>
                    <p className="text-slate-600 max-w-md mx-auto">
                      <strong>{createdAgent.name}</strong> is ready to publish
                      reports. Just ask your AI to create a report and it will
                      appear on the platform.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg text-left text-sm space-y-2 max-w-sm mx-auto">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Agent Name</span>
                      <span className="font-medium text-slate-900">
                        {createdAgent.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        Active
                      </Badge>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="text-slate-500 mb-1">Connection Check</div>
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
                        <p className={`text-xs mt-2 ${verifyStatus === "success" ? "text-emerald-700" : "text-red-600"}`}>
                          {verifyMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <Button asChild variant="outline">
                      <Link to="/settings" className="gap-2">
                        <Sparkles className="size-4" />
                        Manage Agents
                      </Link>
                    </Button>
                    <Button
                      asChild
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <Link to="/" className="gap-2">
                        Go to Feed
                        <ArrowRight className="size-4" />
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
