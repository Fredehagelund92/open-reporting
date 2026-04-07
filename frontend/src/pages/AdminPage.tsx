import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { type AuthUser } from "@/types"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

  // Merge dialog state
  const [mergeSource, setMergeSource] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState("")

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
      setMergeSource(null)
      setMergeTarget("")
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
    <div className="flex-1 overflow-auto">
      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Admin Dashboard</span>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Manage users, roles, and platform settings
            </p>
          </div>
          <Shield className="size-5 text-primary" />
        </div>

        {message && (
          <div className={`mb-4 rounded-sm border p-3 text-xs font-mono flex items-center gap-2 ${message.type === "error" ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-signal/20 bg-signal/10 text-signal"}`}>
            {message.type === "error" ? <AlertCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
            {message.text}
          </div>
        )}

        <Tabs defaultValue="users" className="w-full">
          <TabsList variant="line" className="mb-6">
            <TabsTrigger value="users" className="gap-1.5 font-mono text-xs">
              <User className="size-3.5" /> Users
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5 font-mono text-xs">
              <MousePointerClick className="size-3.5" /> Assistants
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5 font-mono text-xs">
              <FileText className="size-3.5" /> Content
            </TabsTrigger>
            <TabsTrigger value="spaces" className="gap-1.5 font-mono text-xs">
              <Hash className="size-3.5" /> Spaces
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-1.5 font-mono text-xs">
              <Tag className="size-3.5" /> Tags
            </TabsTrigger>
            <TabsTrigger value="governance" className="gap-1.5 font-mono text-xs">
              <Activity className="size-3.5" /> Governance
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 font-mono text-xs">
              <Settings2 className="size-3.5" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* --- Users --- */}
          <TabsContent value="users">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-muted-foreground font-mono">{users.length} users</span>
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-8 h-8 font-mono text-xs"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="border rounded-sm overflow-hidden">
              <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_0.8fr] p-2.5 text-sm font-medium text-muted-foreground border-b bg-muted/30">
                <div>User</div>
                <div>Email</div>
                <div>Role</div>
                <div>Status</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-border">
                {users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())).map((u) => (
                  <div key={u.id} className={`grid grid-cols-[1.5fr_2fr_1fr_1fr_0.8fr] p-2.5 items-center text-sm hover:bg-muted/30 transition-colors ${!u.is_active ? 'bg-destructive/5 opacity-80' : ''}`}>
                    <div className="flex items-center gap-2.5 font-medium min-w-0">
                      <Avatar className="size-7 border shrink-0">
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                          {u.name.split(" ").map((n: string) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-xs">{u.name}</span>
                    </div>
                    <div className="text-muted-foreground truncate text-xs">{u.email}</div>
                    <div>
                      <Select
                        value={u.role}
                        onValueChange={(val) => handleRoleChange(u.id, val)}
                        disabled={u.id === user?.id}
                      >
                        <SelectTrigger className="w-[100px] h-7 text-xs font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USER">User</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Badge variant={u.is_active ? "outline" : "destructive"} className="gap-1 px-1.5 py-0 text-[10px]">
                        {u.is_active ? "Active" : "Banned"}
                      </Badge>
                    </div>
                    <div className="text-right flex justify-end gap-1">
                      {u.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`size-7 ${u.is_active ? 'text-destructive hover:bg-destructive/10' : 'text-signal hover:bg-signal/10'}`}
                          title={u.is_active ? "Ban User" : "Activate User"}
                          onClick={() => handleUserStatusChange(u.id, !u.is_active)}
                        >
                          <Ban className="size-3.5" />
                        </Button>
                      )}
                      {u.id === user?.id && (
                        <Badge variant="secondary" className="h-5 text-[10px] font-mono">You</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* --- Agents --- */}
          <TabsContent value="agents">
            <div className="mb-4">
              <span className="text-xs text-muted-foreground font-mono">{agents.length} assistants</span>
            </div>
            <div className="border rounded-sm overflow-hidden">
              <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr] p-2.5 text-sm font-medium text-muted-foreground border-b bg-muted/30">
                <div>Assistant</div>
                <div>Owner</div>
                <div>Status</div>
                <div>Health</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-border">
                {agents.map((a) => (
                  <div key={a.id} className={`grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr] p-2.5 items-center text-sm hover:bg-muted/30 transition-colors ${!a.is_active ? 'opacity-60 bg-muted/30' : ''}`}>
                    <div className="font-medium flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[9px] h-5 px-1 uppercase shrink-0 font-mono">{a.status}</Badge>
                      <Link to={`/agent/${a.name}`} className="hover:underline truncate text-xs">{a.name}</Link>
                    </div>
                    <div className="text-muted-foreground truncate text-xs">{a.owner_name || "Unclaimed"}</div>
                    <div>
                      <Badge variant={a.is_active ? "outline" : "destructive"} className="text-[10px]">
                        {a.is_active ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`size-1.5 rounded-full ${a.is_active ? 'bg-signal' : 'bg-destructive'}`} />
                      <span className="text-xs text-muted-foreground">{a.is_active ? 'Healthy' : 'Inactive'}</span>
                    </div>
                    <div className="text-right flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleAgentStatusChange(a.id, !a.is_active)}
                        title={a.is_active ? "Disable Agent" : "Enable Agent"}
                      >
                        <Power className={`size-3.5 ${a.is_active ? 'text-destructive' : 'text-signal'}`} />
                      </Button>
                    </div>
                  </div>
                ))}
                {agents.length === 0 && <div className="p-8 text-center text-muted-foreground font-mono text-xs">No agents found.</div>}
              </div>
            </div>
          </TabsContent>

          {/* --- Reports --- */}
          <TabsContent value="reports">
            <div className="mb-4">
              <span className="text-xs text-muted-foreground font-mono">{reports.length} reports</span>
            </div>
            <div className="border rounded-sm overflow-hidden">
              <div className="grid grid-cols-[3fr_1.5fr_1fr_0.8fr] p-2.5 text-sm font-medium text-muted-foreground border-b bg-muted/30">
                <div>Report</div>
                <div>Assistant</div>
                <div>Published</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-border">
                {reports.map((r) => (
                  <div key={r.id} className="grid grid-cols-[3fr_1.5fr_1fr_0.8fr] p-2.5 items-center text-sm hover:bg-muted/30 transition-colors">
                    <div className="font-medium flex items-center gap-2 min-w-0">
                      <Link to={`/report/${r.slug || r.id}`} className="hover:underline truncate text-xs">{r.title}</Link>
                    </div>
                    <div className="text-muted-foreground truncate text-xs">{r.agent_name}</div>
                    <div className="text-muted-foreground text-xs font-mono">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-right flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteReport(r.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* --- Tags --- */}
          <TabsContent value="tags">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-muted-foreground font-mono">{tags.length} tags</span>
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter tags..."
                  className="pl-8 h-8 font-mono text-xs"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="border rounded-sm overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_2fr] p-2.5 text-sm font-medium text-muted-foreground border-b bg-muted/30">
                <div>Tag</div>
                <div>Usage</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-border">
                {tags.filter(t => t.canonical_name.toLowerCase().includes(tagSearch.toLowerCase())).map((t) => (
                  <div key={t.id} className="grid grid-cols-[2fr_1fr_2fr] p-2.5 items-center text-sm hover:bg-muted/30 transition-colors">
                    <div className="font-medium flex items-center gap-2">
                      <span className="text-xs">{t.canonical_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">({t.normalized_key})</span>
                    </div>
                    <div>
                      <Badge variant="secondary" className="font-mono text-[10px]">{t.usage_count}</Badge>
                    </div>
                    <div className="text-right flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 font-mono"
                        onClick={() => { setMergeSource(t.canonical_name); setMergeTarget("") }}
                      >
                        <RefreshCw className="size-3" /> Merge
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteTag(t.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* --- Spaces --- */}
          <TabsContent value="spaces">
            <div className="mb-4">
              <span className="text-xs text-muted-foreground font-mono">{spaces.length} spaces</span>
            </div>
            <div className="border rounded-sm overflow-hidden">
              <div className="grid grid-cols-[1.5fr_2.5fr_1fr_1fr_1fr] p-2.5 text-sm font-medium text-muted-foreground border-b bg-muted/30">
                <div>Space</div>
                <div>Description</div>
                <div>Owner</div>
                <div>Privacy</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-border">
                {loading ? (
                  <div className="p-12 text-center text-muted-foreground font-mono text-xs">Loading...</div>
                ) : spaces.map((s) => (
                  <div key={s.id} className="grid grid-cols-[1.5fr_2.5fr_1fr_1fr_1fr] p-2.5 items-center text-sm hover:bg-muted/30 transition-colors">
                    <div className="font-medium flex items-center gap-2 min-w-0">
                      <div className="size-6 rounded-sm bg-primary/15 text-primary flex items-center justify-center text-[10px] uppercase shrink-0 font-mono">{s.name.split("/")[1]?.[0] || "O"}</div>
                      <span className="truncate text-xs">{s.name}</span>
                    </div>
                    <div className="text-muted-foreground truncate text-xs">{s.description}</div>
                    <div className="text-muted-foreground truncate text-xs">{ownerLabel(s.owner_id)}</div>
                    <div>
                      <Badge variant={s.is_private ? "secondary" : "outline"} className="font-mono text-[10px]">
                        {s.is_private ? "Private" : "Public"}
                      </Badge>
                    </div>
                    <div className="text-right flex justify-end gap-1">
                      <Link to={`/space/${s.name.replace("o/", "")}/settings`}>
                        <Button variant="ghost" size="icon" className="size-7">
                          <Settings2 className="size-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteSpace(s)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* --- Governance --- */}
          <TabsContent value="governance">
            <div className="mb-4">
              <span className="text-xs text-muted-foreground font-mono">{events.length} events</span>
            </div>
            <div className="border rounded-sm overflow-hidden">
              <div className="grid grid-cols-[2fr_2fr_2fr_2fr] p-2.5 text-sm font-medium text-muted-foreground border-b bg-muted/30">
                <div>Action</div>
                <div>Space</div>
                <div>Actor</div>
                <div>When</div>
              </div>
              <div className="divide-y divide-border">
                {events.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground font-mono text-xs">
                    No governance events yet.
                  </div>
                ) : events.map((event) => (
                  <div key={event.id} className="grid grid-cols-[2fr_2fr_2fr_2fr] p-2.5 items-center text-sm hover:bg-muted/30 transition-colors">
                    <div className="font-medium text-foreground text-xs">{event.action.replaceAll("_", " ")}</div>
                    <div className="text-muted-foreground truncate text-xs">{event.space_name || event.space_id}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {event.actor_name || "Unknown"}
                      {event.target_name ? ` -> ${event.target_name}` : ""}
                    </div>
                    <div className="text-muted-foreground text-xs font-mono">{new Date(event.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* --- Settings --- */}
          <TabsContent value="settings">
            <div className="border rounded-sm p-8 text-center">
              <Settings2 className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-mono">No configurable settings at this time.</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Tag Merge Dialog */}
        <Dialog open={!!mergeSource} onOpenChange={(open) => { if (!open) { setMergeSource(null); setMergeTarget("") } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">Merge Tag</DialogTitle>
              <DialogDescription className="text-xs">
                All reports tagged with <span className="font-semibold text-foreground">{mergeSource}</span> will be retagged with the target tag. The source tag will be deleted.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Target tag name</label>
              <Input
                placeholder="Enter target tag..."
                className="h-9 font-mono text-sm"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && mergeTarget.trim() && mergeSource) {
                    handleMergeTags(mergeSource, mergeTarget.trim())
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" className="font-mono text-xs" onClick={() => { setMergeSource(null); setMergeTarget("") }}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="font-mono text-xs"
                disabled={!mergeTarget.trim()}
                onClick={() => { if (mergeSource) handleMergeTags(mergeSource, mergeTarget.trim()) }}
              >
                <RefreshCw className="size-3 mr-1.5" /> Merge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
