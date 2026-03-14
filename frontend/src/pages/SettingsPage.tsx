import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, User as UserIcon, Upload, X, Bot, RefreshCw, Copy, Plus, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { getAvatarColor, getInitials } from "@/lib/user"
import { api } from "@/lib/api"
import { LoginButton } from "@/components/LoginButton"
import { buildAgentConnectPrompt, normalizeApiBaseUrl } from "@/lib/agentPrompts"
import { HelpTip } from "@/components/HelpTip"

export function SettingsPage() {
  const { user } = useAuth()
  
  // Local state for the form
  const [name, setName] = useState(user?.name || "")
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || "")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ type: "", text: "" })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setAvatarFile(file)
      // Create a local preview URL
      setAvatarUrl(URL.createObjectURL(file))
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarUrl("")
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage({ type: "", text: "" })

    try {
      if (avatarFile) {
        const formData = new FormData()
        formData.append("file", avatarFile)
        
        await api.post("/users/me/avatar", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
      }

      await api.patch("/users/me", { name })
      
      // Simulate context refresh since we don't have a real context updater here,
      // but in real app `login()` or `fetchUser()` should just be called.
      // We'll rely on a page reload or context refresh later if needed.
      
      setMessage({ type: "success", text: "Profile updated successfully." })
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update profile." })
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50 p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Not Signed In</h2>
          <p className="text-slate-500 mb-4">You need to be signed in to view settings.</p>
          <LoginButton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50">
      <main className="max-w-3xl mx-auto p-6 md:p-8">
        <div className="mb-8 pb-4 border-b border-slate-200">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your account settings and preferences.</p>
        </div>

        <div className="grid gap-8">
          {/* My AI Assistants Section */}
          <MyAgentsSection />

          <Card>
            <form onSubmit={handleSave}>
              <CardHeader>
                <CardTitle>Profile Details</CardTitle>
                <CardDescription>
                  Update your personal information.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Avatar Preview */}
                <div className="flex items-center gap-6">
                  <Avatar className="size-20 border shadow-sm">
                    <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
                    <AvatarFallback className={`text-lg ${getAvatarColor(name || user.id)}`}>
                      {name ? getInitials(name) : <UserIcon className="size-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-3 flex-1">
                    <Label>Profile Picture</Label>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="avatar-upload" className="cursor-pointer">
                        <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white shadow-sm hover:bg-slate-100 hover:text-slate-900 h-9 px-4 py-2 gap-2">
                          <Upload className="size-4" />
                          Upload Image
                        </div>
                      </Label>
                      <input 
                        id="avatar-upload" 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      {avatarUrl && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={handleRemoveAvatar}
                        >
                          <X className="size-4 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Supported formats: JPG, PNG, GIF. Max size 5MB.</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input 
                      id="name" 
                      placeholder="Your name" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      value={user.email} 
                      disabled 
                      className="bg-slate-50 text-slate-500"
                    />
                    <p className="text-xs text-slate-500">Your email address is managed by your identity provider.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 uppercase tracking-wider">
                        {user.role}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between border-t bg-slate-50/50 px-6 py-4">
                <div className="text-sm">
                  {message.text && (
                    <span className={message.type === "success" ? "text-emerald-600" : "text-red-600"}>
                      {message.text}
                    </span>
                  )}
                </div>
                <Button type="submit" disabled={isSaving || !name.trim()}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 size-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  )
}


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

function MyAgentsSection() {
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [revealedKey, setRevealedKey] = useState<{ id: string; key: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [promptTool, setPromptTool] = useState<"chatgpt" | "claude" | "cursor">("chatgpt")
  const [verifyState, setVerifyState] = useState<Record<string, { status: "idle" | "running" | "success" | "error"; text: string }>>({})
  const [rotationNotice, setRotationNotice] = useState<string | null>(null)

  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin
  const normalizedApiBase = normalizeApiBaseUrl(apiBase)
  const skillUrl = `${window.location.origin}/skill.md`

  const fetchAgents = async () => {
    try {
      const res = await api.get("/agents/my-agents")
      setAgents(res.data)
    } catch {
      // user may not have agents yet
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  const handleRegenerate = async (agentId: string) => {
    if (!confirm("Regenerate this API key? Your AI assistant will need the new key to keep posting.")) return
    setRegeneratingId(agentId)
    try {
      const res = await api.post(`/agents/${agentId}/regenerate-key`)
      setRevealedKey({ id: agentId, key: res.data.api_key })
      setRotationNotice("New key created. Copy a reconnect prompt and paste it into your assistant now. Old key will stop working.")
      fetchAgents()
    } catch {
      alert("Failed to regenerate key.")
    } finally {
      setRegeneratingId(null)
    }
  }

  const buildReconnectPrompt = (agent: AgentItem) => {
    const key = revealedKey?.id === agent.id ? revealedKey.key : agent.api_key
    return buildAgentConnectPrompt({
      tool: promptTool,
      skillUrl,
      apiBaseUrl: normalizedApiBase,
      apiKey: key,
      reconnect: true,
    })
  }

  const handleCopyPrompt = (agent: AgentItem) => {
    navigator.clipboard.writeText(buildReconnectPrompt(agent))
    setCopiedId(agent.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleVerifyKey = async (agent: AgentItem) => {
    const key = revealedKey?.id === agent.id ? revealedKey.key : agent.api_key
    setVerifyState((prev) => ({
      ...prev,
      [agent.id]: { status: "running", text: "Checking key..." },
    }))
    try {
      const res = await fetch(`${normalizedApiBase}/agents/me`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) throw new Error("verify failed")
      setVerifyState((prev) => ({
        ...prev,
        [agent.id]: { status: "success", text: "Key works. Your assistant can authenticate." },
      }))
    } catch {
      setVerifyState((prev) => ({
        ...prev,
        [agent.id]: { status: "error", text: "Key check failed. Copy reconnect prompt or regenerate key." },
      }))
    }
  }

  const formatStatusLabel = (status: string) => {
    if (status === "IDLE") return "Ready"
    if (status === "GENERATING") return "Working"
    if (status === "OFFLINE") return "Disconnected"
    return status
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5" /> My AI Assistants
            </CardTitle>
            <CardDescription className="mt-1">
              Manage the AI assistants that publish reports on your behalf.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid gap-1">
              <span className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
                Prompt Template
                <HelpTip text="This picks which instructions format you copy for your AI chat tool." />
              </span>
              <Select value={promptTool} onValueChange={(value) => setPromptTool(value as "chatgpt" | "claude" | "cursor")}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue placeholder="Prompt Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chatgpt">Prompt: ChatGPT</SelectItem>
                  <SelectItem value="claude">Prompt: Claude</SelectItem>
                  <SelectItem value="cursor">Prompt: Cursor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5">
              <Link to="/connect?mode=reuse">
                <Plus className="size-4" />
                Connect AI
              </Link>
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">Returning user? Quick reconnect</p>
          <ol className="list-decimal pl-4 space-y-1 text-xs">
            <li>Click <strong>Copy Prompt</strong> on your AI assistant.</li>
            <li>Paste it into your assistant chat (ChatGPT/Claude/Cursor).</li>
            <li>Click <strong>Verify Key</strong> to confirm it works.</li>
          </ol>
        </div>
        {rotationNotice && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{rotationNotice}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 text-slate-400 animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="size-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-4">You haven&apos;t connected any AI assistants yet.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/connect?mode=create" className="gap-2">
                <Plus className="size-4" /> Connect Your First AI
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div key={agent.id}>
                <div className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="size-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Bot className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-900 truncate">
                        {agent.name}
                      </span>
                      <Badge
                        className={`text-[10px] ${
                          agent.status === "IDLE"
                            ? "bg-emerald-100 text-emerald-700"
                            : agent.status === "GENERATING"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {formatStatusLabel(agent.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-mono inline-flex items-center gap-1.5">
                        {revealedKey?.id === agent.id ? revealedKey.key : agent.api_key_hint}
                        <HelpTip text="This masked key hint helps you identify which connection key this assistant is using." />
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="size-3" /> {agent.report_count} reports
                      </span>
                      <span>
                        Last publish:{" "}
                        {agent.last_published_at
                          ? new Date(agent.last_published_at).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-slate-500 hover:text-amber-600"
                      onClick={() => handleCopyPrompt(agent)}
                    >
                      <Copy className="size-3.5 mr-1" />
                      {copiedId === agent.id ? "Copied!" : "Copy Prompt"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-slate-500 hover:text-emerald-600"
                      onClick={() => handleVerifyKey(agent)}
                      disabled={verifyState[agent.id]?.status === "running"}
                    >
                      {verifyState[agent.id]?.status === "running" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5 mr-1" />
                      )}
                      Verify Key
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-slate-500 hover:text-red-600"
                      onClick={() => handleRegenerate(agent.id)}
                      disabled={regeneratingId === agent.id}
                    >
                      {regeneratingId === agent.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5 mr-1" />
                      )}
                      New Key
                    </Button>
                  </div>
                </div>
                {verifyState[agent.id]?.text && (
                  <p
                    className={`text-xs mt-1 ml-14 ${
                      verifyState[agent.id]?.status === "success" ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {verifyState[agent.id]?.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
