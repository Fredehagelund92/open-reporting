import { useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, User as UserIcon, Upload, X, Bot, RefreshCw, Copy, Plus, FileText, CheckCircle2, AlertCircle, Bell, Mail, MoreHorizontal, ShieldCheck, KeyRound, MessageSquareText, ChevronDown, ChevronUp } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { getAvatarColor, getInitials } from "@/lib/user"
import { api } from "@/lib/api"
import { LoginButton } from "@/components/LoginButton"
import { buildAgentConnectPrompt, normalizeApiBaseUrl } from "@/lib/agentPrompts"
import { HelpTip } from "@/components/HelpTip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { NotificationSettings } from "@/components/NotificationSettings"
import { AgentTypeBadge } from "@/components/AgentTypeBadge"

export function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get("tab") === "assistants" ? "assistants" : searchParams.get("tab") === "notifications" ? "notifications" : "profile"

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
      
      // Update global context so name change reflects in sidebar/profile immediately
      await refreshUser()
      
      setMessage({ type: "success", text: "Profile updated successfully." })
    } catch {
      setMessage({ type: "error", text: "Failed to update profile." })
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/50 p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Not Signed In</h2>
          <p className="text-muted-foreground mb-4">You need to be signed in to view settings.</p>
          <LoginButton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-muted/50">
      <main className="max-w-3xl mx-auto p-6 md:p-8">
        <div className="mb-8 pb-4 border-b border-border">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account settings and preferences.</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="profile" className="gap-2">
              <UserIcon className="size-4" /> Profile
            </TabsTrigger>
            <TabsTrigger value="assistants" className="gap-2">
              <Bot className="size-4" /> AI Assistants
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="size-4" /> Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-4">
              {/* Left Column: Identity Card */}
              <div className="md:col-span-4 space-y-6">
                <Card className="overflow-hidden border-none shadow-md bg-card/50 backdrop-blur-sm py-0">
                  <div className="h-20 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
                  <CardContent className="relative pt-0 pb-6 px-6 text-center">
                    <div className="flex justify-center -mt-10 mb-4">
                      <div className="relative group">
                        <Avatar className="size-24 border-4 border-card shadow-xl transition-transform duration-300 group-hover:scale-105">
                          <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
                          <AvatarFallback className={`text-2xl font-bold ${getAvatarColor(name || user.id)}`}>
                            {name ? getInitials(name) : <UserIcon className="size-10" />}
                          </AvatarFallback>
                        </Avatar>
                        <Label
                          htmlFor="avatar-upload"
                          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-full"
                        >
                          <Upload className="size-6" />
                        </Label>
                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-foreground truncate">{name || user.name || "Your Name"}</h3>
                    <p className="text-muted-foreground text-sm truncate mb-4">{user.email}</p>
                    
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider bg-muted/50 border-primary/20 text-primary">
                        {user.role}
                      </Badge>
                    </div>

                    {avatarUrl && (
                      <div className="mt-6 flex justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 text-xs h-8"
                          onClick={handleRemoveAvatar}
                        >
                          <X className="size-3 mr-1.5" /> Remove Photo
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 space-y-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-widest">Community Identity</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This is how the community sees you across Open Reporting. Your profile details are public and help build trust within the platform.
                  </p>
                </div>
              </div>

              {/* Right Column: Edit Form */}
              <div className="md:col-span-8">
                <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
                  <form onSubmit={handleSave}>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-bold">Personal Information</CardTitle>
                      <CardDescription>
                        Update your public profile information.
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-semibold">Public Display Name</Label>
                        <Input 
                          id="name" 
                          placeholder="Your name" 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="bg-background/50 border-border/50 focus:ring-primary/50"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          This is the name people see on your reports and comments.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-semibold">Verified Email</Label>
                        <div className="relative">
                          <Input 
                            id="email" 
                            value={user.email} 
                            disabled 
                            className="bg-muted/50 text-muted-foreground border-transparent cursor-not-allowed pl-9"
                          />
                          <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground/50" />
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="size-3 text-signal" />
                          Email managed by {user.provider}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-border/10">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/10">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-primary">Two-Factor Authentication</p>
                            <p className="text-xs text-muted-foreground">Enhanced security for your account.</p>
                          </div>
                          <Badge variant="outline" className="bg-white/50 dark:bg-black/50 text-[10px] font-bold">COMING SOON</Badge>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="flex items-center justify-between bg-muted/20 px-6 py-4 rounded-b-xl border-t border-border/10">
                      <div className="text-sm">
                        {message.text && (
                          <span className={`flex items-center gap-1.5 ${message.type === "success" ? "text-signal" : "text-destructive"}`}>
                            {message.type === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                            {message.text}
                          </span>
                        )}
                      </div>
                      <Button type="submit" disabled={isSaving || !name.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-primary/20 shadow-lg">
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 size-4" />
                            Update Profile
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assistants">
            <MyAgentsSection />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}


interface AgentItem {
  id: string
  name: string
  description: string | null
  status: string
  agent_type?: string
  api_key: string
  api_key_hint: string
  report_count: number
  created_at: string
  last_published_at?: string | null
  chat_enabled?: boolean
  chat_endpoint?: string | null
  chat_stream_endpoint?: string | null
}

interface ChatSettings {
  chat_enabled: boolean
  chat_endpoint: string
  chat_stream_endpoint: string
}

function MyAgentsSection() {
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [revealedKey, setRevealedKey] = useState<{ id: string; key: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [verifyState, setVerifyState] = useState<Record<string, { status: "idle" | "running" | "success" | "error"; text: string }>>({})
  const [rotationNotice, setRotationNotice] = useState<string | null>(null)
  const [expandedChat, setExpandedChat] = useState<string | null>(null)
  const [chatDraft, setChatDraft] = useState<Record<string, ChatSettings>>({})
  const [chatSaving, setChatSaving] = useState<string | null>(null)
  const [chatSaveStatus, setChatSaveStatus] = useState<Record<string, "idle" | "success" | "error">>({})

  // Inline agent creation
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<"reporter" | "chat_assistant">("reporter")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin
  const normalizedApiBase = normalizeApiBaseUrl(apiBase)
  const skillUrl = `${window.location.origin}/skill.md`

  const handleCreateAgent = async () => {
    if (!newName.trim()) return
    setIsCreating(true)
    setCreateError("")
    setCreatedKey(null)
    try {
      const res = await api.post("/agents/register-for-me", {
        name: newName.trim(),
        agent_type: newType,
      })
      setCreatedKey(res.data.agent.api_key)
      setNewName("")
      setNewType("reporter")
      fetchAgents()
    } catch {
      setCreateError("Failed to create assistant.")
    } finally {
      setIsCreating(false)
    }
  }

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

  const toggleChatPanel = (agent: AgentItem) => {
    if (expandedChat === agent.id) {
      setExpandedChat(null)
    } else {
      setExpandedChat(agent.id)
      if (!chatDraft[agent.id]) {
        setChatDraft((prev) => ({
          ...prev,
          [agent.id]: {
            chat_enabled: agent.chat_enabled ?? false,
            chat_endpoint: agent.chat_endpoint ?? "",
            chat_stream_endpoint: agent.chat_stream_endpoint ?? "",
          },
        }))
      }
    }
  }

  const updateChatDraft = (agentId: string, patch: Partial<ChatSettings>) => {
    setChatDraft((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], ...patch },
    }))
  }

  const saveChatSettings = async (agentId: string) => {
    const draft = chatDraft[agentId]
    if (!draft) return
    setChatSaving(agentId)
    setChatSaveStatus((prev) => ({ ...prev, [agentId]: "idle" }))
    try {
      await api.patch(`/agents/${agentId}/chat-settings`, {
        chat_enabled: draft.chat_enabled,
        chat_endpoint: draft.chat_endpoint || "",
        chat_stream_endpoint: draft.chat_stream_endpoint || "",
      })
      setChatSaveStatus((prev) => ({ ...prev, [agentId]: "success" }))
      setTimeout(() => setChatSaveStatus((prev) => ({ ...prev, [agentId]: "idle" })), 3000)
      fetchAgents()
    } catch {
      setChatSaveStatus((prev) => ({ ...prev, [agentId]: "error" }))
      setTimeout(() => setChatSaveStatus((prev) => ({ ...prev, [agentId]: "idle" })), 3000)
    } finally {
      setChatSaving(null)
    }
  }

  const formatStatusLabel = (status: string) => {
    if (status === "IDLE") return "Ready"
    if (status === "GENERATING") return "Working"
    if (status === "OFFLINE") return "Disconnected"
    return status
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">My AI Assistants</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage connections and API keys for your assistants.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { setShowCreate(true); setCreatedKey(null); setCreateError("") }}>
          <Plus className="size-4" />
          New Assistant
        </Button>
      </div>

      {rotationNotice && (
        <div className="rounded-md border border-signal/20 bg-signal/10 p-3 text-xs text-signal flex items-start gap-2">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{rotationNotice}</span>
        </div>
      )}

      {showCreate && (
        <Card className="border-primary/20">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Create a new assistant</p>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowCreate(false)}><X className="size-4" /></Button>
            </div>
            <Input
              placeholder="Assistant name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateAgent()}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewType("reporter")}
                className={`flex items-start gap-3 rounded-sm border p-3 text-left transition-colors ${
                  newType === "reporter"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <FileText className={`size-4 mt-0.5 shrink-0 ${newType === "reporter" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className={`text-sm font-medium ${newType === "reporter" ? "text-foreground" : "text-muted-foreground"}`}>Reporter</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Publishes reports and presentations</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setNewType("chat_assistant")}
                className={`flex items-start gap-3 rounded-sm border p-3 text-left transition-colors ${
                  newType === "chat_assistant"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <MessageSquareText className={`size-4 mt-0.5 shrink-0 ${newType === "chat_assistant" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className={`text-sm font-medium ${newType === "chat_assistant" ? "text-foreground" : "text-muted-foreground"}`}>Interactive</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">Publishes reports + enables chat</p>
                </div>
              </button>
            </div>
            <Button size="sm" className="w-full" disabled={isCreating || !newName.trim()} onClick={handleCreateAgent}>
              {isCreating ? <Loader2 className="size-4 animate-spin" /> : "Create Assistant"}
            </Button>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
            {createdKey && (
              <div className="rounded-md border border-signal/20 bg-signal/5 p-3">
                <p className="text-xs font-semibold text-foreground mb-1">Assistant created! Your API key:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted/50 px-2 py-1 rounded break-all">{createdKey}</code>
                  <Button variant="ghost" size="icon-sm" onClick={() => { navigator.clipboard.writeText(createdKey); }}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Save this key now — it won't be shown again in full.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 text-muted-foreground animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-center py-10">
            <Bot className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No assistants yet.</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowCreate(true); setCreatedKey(null); setCreateError("") }}>
              <Plus className="size-4" /> Create Your First Assistant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div key={agent.id} className="group rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status dot + Name */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div
                    className={`size-2 rounded-full shrink-0 ${
                      agent.status === "IDLE"
                        ? "bg-signal"
                        : agent.status === "GENERATING"
                        ? "bg-primary animate-pulse"
                        : "bg-muted-foreground/30"
                    }`}
                    title={formatStatusLabel(agent.status)}
                  />
                  <span className="font-semibold text-sm text-foreground truncate">
                    {agent.name}
                  </span>
                  <AgentTypeBadge agentType={agent.agent_type} />
                  <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                    {revealedKey?.id === agent.id ? revealedKey.key : agent.api_key_hint}
                  </span>
                  <HelpTip text="Masked API key hint — use Copy Prompt or Verify to work with the full key." />
                </div>

                {/* Stats */}
                <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1 shrink-0">
                  <FileText className="size-3" /> {agent.report_count}
                </span>

                {/* Primary action */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs text-muted-foreground hover:text-primary shrink-0"
                  onClick={() => handleCopyPrompt(agent)}
                >
                  <Copy className="size-3 mr-1.5" />
                  {copiedId === agent.id ? "Copied!" : "Copy Prompt"}
                </Button>

                {/* Overflow menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => handleVerifyKey(agent)}
                      disabled={verifyState[agent.id]?.status === "running"}
                      className="gap-2 text-xs"
                    >
                      {verifyState[agent.id]?.status === "running" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="size-3.5" />
                      )}
                      Verify Key
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toggleChatPanel(agent)}
                      className="gap-2 text-xs"
                    >
                      <MessageSquareText className="size-3.5" />
                      Chat Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleRegenerate(agent.id)}
                      disabled={regeneratingId === agent.id}
                      className="gap-2 text-xs text-destructive focus:text-destructive"
                    >
                      {regeneratingId === agent.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <KeyRound className="size-3.5" />
                      )}
                      Regenerate Key
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Verify feedback — shown inline below the row */}
              {verifyState[agent.id]?.text && (
                <div className={`px-4 pb-3 -mt-1 text-xs flex items-center gap-1.5 ${
                  verifyState[agent.id]?.status === "success" ? "text-signal" : "text-destructive"
                }`}>
                  {verifyState[agent.id]?.status === "success" ? (
                    <CheckCircle2 className="size-3" />
                  ) : (
                    <AlertCircle className="size-3" />
                  )}
                  {verifyState[agent.id]?.text}
                </div>
              )}

              {/* Chat Settings Panel */}
              {expandedChat === agent.id && chatDraft[agent.id] && (
                <div className="px-4 pb-4 border-t border-border/50 mt-1 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`chat-enabled-${agent.id}`} className="text-xs font-medium">Enable Q&A Chat</Label>
                    <Switch
                      id={`chat-enabled-${agent.id}`}
                      checked={chatDraft[agent.id].chat_enabled}
                      onCheckedChange={(v) => updateChatDraft(agent.id, { chat_enabled: v })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`chat-ep-${agent.id}`} className="text-xs font-medium">Chat Endpoint URL</Label>
                    <Input
                      id={`chat-ep-${agent.id}`}
                      type="url"
                      placeholder="https://your-agent.example.com/chat"
                      value={chatDraft[agent.id].chat_endpoint}
                      onChange={(e) => updateChatDraft(agent.id, { chat_endpoint: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Required when chat is enabled.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`chat-stream-${agent.id}`} className="text-xs font-medium">Stream Endpoint URL (optional)</Label>
                    <Input
                      id={`chat-stream-${agent.id}`}
                      type="url"
                      placeholder="https://your-agent.example.com/chat/stream"
                      value={chatDraft[agent.id].chat_stream_endpoint}
                      onChange={(e) => updateChatDraft(agent.id, { chat_stream_endpoint: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Enables SSE streaming for real-time responses.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => saveChatSettings(agent.id)}
                      disabled={chatSaving === agent.id}
                    >
                      {chatSaving === agent.id ? (
                        <Loader2 className="size-3 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="size-3 mr-1.5" />
                      )}
                      Save
                    </Button>
                    {chatSaveStatus[agent.id] === "success" && (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="size-3" /> Saved
                      </span>
                    )}
                    {chatSaveStatus[agent.id] === "error" && (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="size-3" /> Failed to save
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
