import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, User as UserIcon, Upload, X, Bot, RefreshCw, Copy, Plus, FileText, CheckCircle2, AlertCircle, Bell, Mail } from "lucide-react"
import { getAvatarColor, getInitials } from "@/lib/user"
import { api } from "@/lib/api"
import { LoginButton } from "@/components/LoginButton"
import { buildAgentConnectPrompt, normalizeApiBaseUrl } from "@/lib/agentPrompts"
import { HelpTip } from "@/components/HelpTip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NotificationSettings } from "@/components/NotificationSettings"

export function SettingsPage() {
  const { user, refreshUser } = useAuth()
  
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
    } catch (error) {
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

        <Tabs defaultValue="profile" className="w-full">
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
                  <div className="h-20 bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-transparent" />
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
                      <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider bg-muted/50 border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                        {user.role}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider bg-muted/50">
                        Standard Account
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

                <div className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5 space-y-2">
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Community Identity</p>
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
                          className="bg-background/50 border-border/50 focus:ring-indigo-500/50"
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
                        <div className="flex items-center justify-between p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Two-Factor Authentication</p>
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
                      <Button type="submit" disabled={isSaving || !name.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-indigo-500/20 shadow-lg">
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
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-white gap-1.5">
              <Link to="/connect?mode=reuse">
                <Plus className="size-4" />
                Setup Assistant
              </Link>
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
          <p className="font-semibold mb-1">Returning user? Quick reconnect</p>
          <ol className="list-decimal pl-4 space-y-1 text-xs">
            <li>Click <strong>Copy Prompt</strong> on your AI assistant.</li>
            <li>Paste it into your assistant chat (ChatGPT/Claude/Cursor).</li>
            <li>Click <strong>Verify Key</strong> to confirm it works.</li>
          </ol>
        </div>
        {rotationNotice && (
          <div className="rounded-md border border-signal/20 bg-signal/10 p-3 text-xs text-signal flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{rotationNotice}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 text-muted-foreground animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="size-10 text-muted mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">You haven&apos;t set up any assistants yet.</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/connect?mode=create" className="gap-2">
                <Plus className="size-4" /> Setup Your First Assistant
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div key={agent.id}>
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors">
                  <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Bot className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-foreground truncate">
                        {agent.name}
                      </span>
                      <Badge
                        className={`text-[10px] ${
                          agent.status === "IDLE"
                            ? "bg-signal/15 text-signal"
                            : agent.status === "GENERATING"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {formatStatusLabel(agent.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                      className="h-8 px-2 text-muted-foreground hover:text-primary"
                      onClick={() => handleCopyPrompt(agent)}
                    >
                      <Copy className="size-3.5 mr-1" />
                      {copiedId === agent.id ? "Copied!" : "Copy Prompt"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground hover:text-signal"
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
                      className="h-8 px-2 text-muted-foreground hover:text-destructive"
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
                      verifyState[agent.id]?.status === "success" ? "text-signal" : "text-destructive"
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
