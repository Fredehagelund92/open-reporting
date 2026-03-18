import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { type AuthUser } from "@/types"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Settings2, Trash2, CheckCircle2, User, Hash, Activity, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Link } from "react-router-dom"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Ban, Power, Tag, FileText, Search, MousePointerClick, RefreshCw } from "lucide-react"

interface GovernanceEvent {
  id: string
  space_id: string
  space_name: string | null
  action: string
  actor_name: string | null
  target_name: string | null
  created_at: string
}

interface AdminSpace {
  id: string
  name: string
  description: string
  owner_id: string
  is_private: boolean
}

interface AdminAgent {
  id: string
  name: string
  status: string
  owner_name: string | null
  is_active: boolean
}

interface AdminTag {
  id: string
  canonical_name: string
  normalized_key: string
  usage_count: number
}

interface AdminReport {
  id: string
  title: string
  slug: string | null
  content_type: string
  agent_name: string
  created_at: string
}

export function AdminPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [spaces, setSpaces] = useState<AdminSpace[]>([])
  const [agents, setAgents] = useState<AdminAgent[]>([])
  const [tags, setTags] = useState<AdminTag[]>([])
  const [reports, setReports] = useState<AdminReport[]>([])
  const [events, setEvents] = useState<GovernanceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)
  
  const [tagSearch, setTagSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")

  useEffect(() => {
    if (user && user.role === "ADMIN") {
      fetchAdminData()
    }
  }, [user])

  const fetchAdminData = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [usersRes, spacesRes, agentsRes, tagsRes, reportsRes, eventsRes] = await Promise.all([
        api.get("/users/"),
        api.get("/spaces/"),
        api.get("/agents/"),
        api.get("/tags/?limit=100"),
        api.get("/reports/"),
        api.get("/spaces/governance-events/recent?limit=50"),
      ])
      setUsers(usersRes.data)
      setSpaces(spacesRes.data)
      setAgents(agentsRes.data)
      setTags(tagsRes.data)
      setReports(reportsRes.data)
      setEvents(eventsRes.data)
    } catch {
      setMessage({ type: "error", text: "Failed to fetch admin data." })
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole })
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setMessage({ type: "success", text: "Role updated." })
    } catch {
      setMessage({ type: "error", text: "Failed to update role." })
    }
  }

  const handleUserStatusChange = async (userId: string, active: boolean) => {
    try {
      await api.patch(`/users/${userId}/status`, { is_active: active })
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: active } : u))
      setMessage({ type: "success", text: `User ${active ? 'activated' : 'deactivated'}.` })
    } catch {
      setMessage({ type: "error", text: "Failed to update user status." })
    }
  }

  const handleAgentStatusChange = async (agentId: string, active: boolean) => {
    try {
      await api.patch(`/agents/${agentId}/status`, { is_active: active })
      setAgents(agents.map(a => a.id === agentId ? { ...a, is_active: active } : a))
      setMessage({ type: "success", text: `Agent ${active ? 'activated' : 'deactivated'}.` })
    } catch {
      setMessage({ type: "error", text: "Failed to update agent status." })
    }
  }

  const handleDeleteSpace = async (space: AdminSpace) => {
    if (!confirm(`Delete ${space.name}? This cannot be undone.`)) return
    try {
      await api.delete(`/spaces/${space.id}`)
      setMessage({ type: "success", text: `Deleted ${space.name}.` })
      fetchAdminData()
    } catch {
      setMessage({ type: "error", text: `Failed to delete ${space.name}.` })
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report? This action is irreversible.")) return
    try {
      await api.delete(`/reports/${reportId}`)
      setReports(reports.filter(r => r.id !== reportId))
      setMessage({ type: "success", text: "Report deleted." })
    } catch {
      setMessage({ type: "error", text: "Failed to delete report." })
    }
  }

  const handleMergeTags = async (source: string, target: string) => {
    if (!confirm(`Merge "${source}" into "${target}"?`)) return
    try {
      await api.post(`/tags/merge?source_tag=${source}&target_tag=${target}`)
      setMessage({ type: "success", text: "Tags merged." })
      fetchAdminData()
    } catch {
      setMessage({ type: "error", text: "Failed to merge tags." })
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm("Delete this tag?")) return
    try {
      await api.delete(`/tags/${tagId}`)
      setTags(tags.filter(t => t.id !== tagId))
      setMessage({ type: "success", text: "Tag deleted." })
    } catch {
      setMessage({ type: "error", text: "Failed to delete tag." })
    }
  }

  const ownerLabel = (ownerId?: string) => {
    if (!ownerId) return "Unowned"
    const owner = users.find((u) => u.id === ownerId)
    return owner ? owner.name : ownerId
  }

  return (
    <div className="flex-1 overflow-auto bg-muted/50">
      <main className="max-w-5xl mx-auto p-6 md:p-8">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border text-foreground">
          <Shield className="size-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage users, roles, and platform settings.</p>
          </div>
        </div>

        {message && (
          <div className={`mb-6 rounded-md border p-3 text-sm flex items-center gap-2 ${message.type === "error" ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-signal/20 bg-signal/10 text-signal"}`}>
            {message.type === "error" ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {message.text}
          </div>
        )}

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="mb-6 bg-muted/80 p-1">
            <TabsTrigger value="users" className="gap-2">
              <User className="size-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <MousePointerClick className="size-4" /> AI Assistants
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="size-4" /> Content
            </TabsTrigger>
            <TabsTrigger value="spaces" className="gap-2">
              <Hash className="size-4" /> Spaces
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-2">
              <Tag className="size-4" /> Tags
            </TabsTrigger>
            <TabsTrigger value="governance" className="gap-2">
              <Activity className="size-4" /> Governance
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="size-4" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="grid gap-8">
              <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="size-5 text-muted-foreground" />
                  User Management
                </CardTitle>
                <CardDescription>
                  View registered users and manage their access roles.
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Search users..." 
                  className="pl-9 h-9" 
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_0.8fr] p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b bg-muted/30">
                  <div>User</div>
                  <div>Email</div>
                  <div>Role</div>
                  <div>Status</div>
                  <div className="text-right whitespace-nowrap">Actions</div>
                </div>
                
                <div className="divide-y">
                  {users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())).map((u) => (
                    <div key={u.id} className={`grid grid-cols-[1.5fr_2fr_1fr_1fr_0.8fr] p-3 items-center text-sm ${!u.is_active ? 'bg-destructive/5 opacity-80' : ''}`}>
                      <div className="flex items-center gap-3 font-medium min-w-0">
                        <Avatar className="size-8 border flex-shrink-0">
                          <AvatarImage src={u.avatar} />
                          <AvatarFallback className="bg-primary/15 text-primary text-xs">
                            {u.name.split(" ").map((n: string) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[180px]">{u.name}</span>
                      </div>
                      <div className="text-muted-foreground truncate">{u.email}</div>
                      <div>
                        <Select 
                          value={u.role} 
                          onValueChange={(val) => handleRoleChange(u.id, val)}
                          disabled={u.id === user?.id}
                        >
                          <SelectTrigger className="w-[110px] h-8 text-xs font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USER">User</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Badge variant={u.is_active ? "outline" : "destructive"} className="gap-1 px-1.5 py-0">
                          {u.is_active ? "Active" : "Banned"}
                        </Badge>
                      </div>
                      <div className="text-right flex justify-end gap-2">
                        {u.id !== user?.id && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`size-8 ${u.is_active ? 'text-destructive hover:bg-destructive/10' : 'text-signal hover:bg-signal/10'}`}
                            title={u.is_active ? "Ban User" : "Activate User"}
                            onClick={() => handleUserStatusChange(u.id, !u.is_active)}
                          >
                            <Ban className="size-4" />
                          </Button>
                        )}
                        {u.id === user?.id && (
                           <Badge variant="secondary" className="h-6">Me</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MousePointerClick className="size-5 text-muted-foreground" />
                  AI Assistant Monitoring
                </CardTitle>
                <CardDescription>Monitor and manage all AI assistants on the platform.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr] p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b bg-muted/30">
                    <div>AI Assistant</div>
                    <div>Owner</div>
                    <div>Status</div>
                    <div>Health</div>
                    <div className="text-right whitespace-nowrap">Actions</div>
                  </div>
                  <div className="divide-y">
                    {agents.map((a) => (
                      <div key={a.id} className={`grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr] p-3 items-center text-sm ${!a.is_active ? 'opacity-60 bg-muted/50' : ''}`}>
                        <div className="font-medium flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[10px] h-5 px-1 uppercase flex-shrink-0">{a.status}</Badge>
                          <Link to={`/agent/${a.name}`} className="hover:underline truncate max-w-[200px]">{a.name}</Link>
                        </div>
                        <div className="text-muted-foreground truncate">{a.owner_name || "Unclaimed"}</div>
                        <div>
                           <Badge variant={a.is_active ? "outline" : "destructive"}>
                              {a.is_active ? "Enabled" : "Disabled"}
                           </Badge>
                        </div>
                        <div className="flex items-center gap-1.5">
                           <div className={`size-2 rounded-full ${a.is_active ? 'bg-signal' : 'bg-destructive'}`} />
                           <span className="text-xs">{a.is_active ? 'Healthy' : 'Inactive'}</span>
                        </div>
                        <div className="text-right flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8"
                            onClick={() => handleAgentStatusChange(a.id, !a.is_active)}
                            title={a.is_active ? "Disable Agent" : "Enable Agent"}
                          >
                            <Power className={`size-4 ${a.is_active ? 'text-destructive' : 'text-signal'}`} />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {agents.length === 0 && <div className="p-8 text-center text-muted-foreground">No agents found.</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="size-5 text-muted-foreground" />
                  Global Content Moderation
                </CardTitle>
                <CardDescription>Moderate all reports and slideshows across the platform.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <div className="grid grid-cols-[3fr_1.5fr_1fr_0.8fr] p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b bg-muted/30">
                    <div>Report / Slideshow</div>
                    <div>AI Assistant</div>
                    <div>Published</div>
                    <div className="text-right whitespace-nowrap">Actions</div>
                  </div>
                  <div className="divide-y">
                    {reports.map((r) => (
                      <div key={r.id} className="grid grid-cols-[3fr_1.5fr_1fr_0.8fr] p-3 items-center text-sm">
                        <div className="font-medium flex items-center gap-2 min-w-0">
                           <Badge variant="secondary" className="text-[9px] h-4 leading-none uppercase flex-shrink-0">{r.content_type}</Badge>
                           <Link to={`/report/${r.slug || r.id}`} className="hover:underline truncate max-w-[320px]">{r.title}</Link>
                        </div>
                        <div className="text-muted-foreground truncate">{r.agent_name}</div>
                        <div className="text-muted-foreground text-xs whitespace-nowrap">
                           {new Date(r.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-right flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteReport(r.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tags">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                   <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="size-5 text-muted-foreground" />
                    Tag Orchestration
                  </CardTitle>
                  <CardDescription>Manage, rename, and merge tags to maintain platform quality.</CardDescription>
                </div>
                <div className="relative w-64">
                   <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                   <Input 
                      placeholder="Filter tags..." 
                      className="pl-9 h-9" 
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                   />
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <div className="grid grid-cols-[2fr_1fr_2fr] p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b bg-muted/30">
                    <div>Canonical Tag</div>
                    <div>Usage</div>
                    <div className="text-right">Orchestration</div>
                  </div>
                  <div className="divide-y">
                    {tags.filter(t => t.canonical_name.toLowerCase().includes(tagSearch.toLowerCase())).map((t) => (
                      <div key={t.id} className="grid grid-cols-[2fr_1fr_2fr] p-3 items-center text-sm">
                        <div className="font-medium flex items-center gap-2">
                           <div className="size-6 bg-muted flex items-center justify-center rounded text-[10px]">#</div>
                           {t.canonical_name}
                           <span className="text-[10px] text-muted-foreground font-mono">({t.normalized_key})</span>
                        </div>
                        <div>
                           <Badge variant="secondary" className="font-mono text-xs">{t.usage_count}</Badge>
                        </div>
                        <div className="text-right flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs gap-1.5"
                            onClick={() => {
                               const target = prompt("Enter target tag name to merge this tag into:")
                               if (target) handleMergeTags(t.canonical_name, target)
                            }}
                          >
                            <RefreshCw className="size-3" /> Merge
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteTag(t.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="spaces">
            <div className="grid gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Hash className="size-5 text-muted-foreground" />
                    All Spaces
                  </CardTitle>
                  <CardDescription>
                    Manage all spaces across the platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border divide-y">
                    <div className="grid grid-cols-[1.5fr_2.5fr_1fr_1fr_1fr] p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b">
                      <div>Space</div>
                      <div>Description</div>
                      <div>Owner</div>
                      <div>Privacy</div>
                      <div className="text-right">Actions</div>
                    </div>
                    {loading ? (
                      <div className="p-12 text-center text-muted-foreground">Loading spaces...</div>
                    ) : spaces.map((s) => (
                      <div key={s.id} className="grid grid-cols-[1.5fr_2.5fr_1fr_1fr_1fr] p-3 items-center text-sm">
                        <div className="font-medium text-foreground flex items-center gap-2 min-w-0">
                          <div className="size-6 rounded bg-primary/15 text-primary flex items-center justify-center text-[10px] uppercase flex-shrink-0">{s.name.split("/")[1]?.[0] || "O"}</div>
                          <span className="truncate max-w-[200px]">{s.name}</span>
                        </div>
                        <div className="text-muted-foreground truncate">{s.description}</div>
                        <div className="text-muted-foreground truncate">{ownerLabel(s.owner_id)}</div>
                        <div>
                          <Badge variant={s.is_private ? "secondary" : "outline"} className="font-normal">
                            {s.is_private ? "Private" : "Public"}
                          </Badge>
                        </div>
                        <div className="text-right flex justify-end gap-2">
                          <Link to={`/space/${s.name.replace("o/", "")}/settings`}>
                            <Button variant="ghost" size="icon" className="size-8">
                              <Settings2 className="size-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteSpace(s)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="governance">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="size-5 text-muted-foreground" />
                  Recent Governance Events
                </CardTitle>
                <CardDescription>Recent owner/admin space management activity.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border divide-y">
                  <div className="grid grid-cols-[2fr_2fr_2fr_2fr] p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted">
                    <div>Action</div>
                    <div>Space</div>
                    <div>Actor</div>
                    <div>When</div>
                  </div>
                  {events.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No governance events yet.
                    </div>
                  ) : events.map((event) => (
                    <div key={event.id} className="grid grid-cols-[2fr_2fr_2fr_2fr] p-3 items-center text-sm">
                      <div className="font-medium text-foreground">{event.action.replaceAll("_", " ")}</div>
                      <div className="text-muted-foreground truncate">{event.space_name || event.space_id}</div>
                      <div className="text-muted-foreground truncate">
                        {event.actor_name || "Unknown"}
                        {event.target_name ? ` -> ${event.target_name}` : ""}
                      </div>
                      <div className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings2 className="size-5" /> Platform Settings
                  </CardTitle>
                  <CardDescription>Configure platform-level settings.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">No configurable settings at this time.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
