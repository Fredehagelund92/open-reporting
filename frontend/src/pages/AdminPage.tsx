import { useState, useEffect } from "react"
import { useAuth, type AuthUser } from "@/context/AuthContext"
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

interface GovernanceEvent {
  id: string
  space_id: string
  space_name: string | null
  action: string
  actor_name: string | null
  target_name: string | null
  created_at: string
}

export function AdminPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [spaces, setSpaces] = useState<any[]>([])
  const [events, setEvents] = useState<GovernanceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)

  useEffect(() => {
    if (user && user.role === "ADMIN") {
      fetchAdminData()
    }
  }, [user])

  const fetchAdminData = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [usersRes, spacesRes, eventsRes] = await Promise.all([
        api.get("/users/"),
        api.get("/spaces/"),
        api.get("/spaces/governance-events/recent?limit=50"),
      ])
      setUsers(usersRes.data)
      setSpaces(spacesRes.data)
      setEvents(eventsRes.data)
    } catch (err) {
      setMessage({ type: "error", text: "Failed to fetch admin data." })
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole })
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as any } : u))
    } catch (err) {
      console.error("Failed to update role", err)
    }
  }

  const handleDeleteSpace = async (space: any) => {
    if (!confirm(`Delete ${space.name}? This cannot be undone.`)) return
    try {
      await api.delete(`/spaces/${space.id}`)
      setMessage({ type: "success", text: `Deleted ${space.name}.` })
      await fetchAdminData()
      window.dispatchEvent(new CustomEvent("refresh-sidebar"))
    } catch {
      setMessage({ type: "error", text: `Failed to delete ${space.name}.` })
    }
  }

  const ownerLabel = (ownerId?: string) => {
    if (!ownerId) return "Unowned"
    const owner = users.find((u) => u.id === ownerId)
    return owner ? owner.name : ownerId
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50">
      <main className="max-w-5xl mx-auto p-6 md:p-8">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-200 text-slate-900">
          <Shield className="size-8 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Manage users, roles, and platform settings.</p>
          </div>
        </div>

        {message && (
          <div className={`mb-6 rounded-md border p-3 text-sm flex items-center gap-2 ${message.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {message.type === "error" ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {message.text}
          </div>
        )}

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="gap-2">
              <User className="size-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="spaces" className="gap-2">
              <Hash className="size-4" /> Spaces
            </TabsTrigger>
            <TabsTrigger value="governance" className="gap-2">
              <Activity className="size-4" /> Governance Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="grid gap-8">
              <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="size-5 text-slate-500" />
                User Management
              </CardTitle>
              <CardDescription>
                View registered users and manage their access roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="grid grid-cols-[1fr_2fr_1fr_1fr] p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b bg-slate-50">
                  <div>User</div>
                  <div>Email</div>
                  <div>Role</div>
                  <div className="text-right">Actions</div>
                </div>
                
                <div className="divide-y">
                  {users.map((u) => (
                    <div key={u.id} className="grid grid-cols-[1fr_2fr_1fr_1fr] p-3 items-center text-sm">
                      <div className="flex items-center gap-3 font-medium">
                        <Avatar className="size-8 border">
                          <AvatarImage src={u.avatar} />
                          <AvatarFallback className="bg-amber-100 text-amber-700 text-xs">
                            {u.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{u.name}</span>
                      </div>
                      <div className="text-slate-500 truncate">{u.email}</div>
                      <div>
                        <Select 
                          value={u.role} 
                          onValueChange={(val) => handleRoleChange(u.id, val)}
                          disabled={u.id === user?.id} // Don't let users remove their own admin access easily
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
                      <div className="text-right flex justify-end gap-2">
                        {u.id !== user?.id && (
                          <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                        {u.id === user?.id && (
                          <div className="flex h-8 items-center text-xs text-slate-400 gap-1 px-2">
                            <CheckCircle2 className="size-3" /> You
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {users.length === 0 && (
                     <div className="p-8 text-center text-slate-500 text-sm">
                       No users found.
                     </div>
                  )}
                </div>
              </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="spaces">
            <div className="grid gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Hash className="size-5 text-slate-500" />
                    All Spaces
                  </CardTitle>
                  <CardDescription>
                    Manage all spaces across the platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border divide-y">
                    <div className="grid grid-cols-[2fr_3fr_1fr_1fr_1fr] p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      <div>Space</div>
                      <div>Description</div>
                      <div>Owner</div>
                      <div>Privacy</div>
                      <div className="text-right">Actions</div>
                    </div>
                    {loading ? (
                      <div className="p-12 text-center text-slate-400">Loading spaces...</div>
                    ) : spaces.map((s) => (
                      <div key={s.id} className="grid grid-cols-[2fr_3fr_1fr_1fr_1fr] p-3 items-center text-sm">
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          <div className="size-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] uppercase">{s.name.split("/")[1]?.[0] || "O"}</div>
                          {s.name}
                        </div>
                        <div className="text-slate-500 truncate">{s.description}</div>
                        <div className="text-slate-500 truncate">{ownerLabel(s.owner_id)}</div>
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
                            className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50"
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
                  <Activity className="size-5 text-slate-500" />
                  Recent Governance Events
                </CardTitle>
                <CardDescription>Recent owner/admin space management activity.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border divide-y">
                  <div className="grid grid-cols-[2fr_2fr_2fr_2fr] p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                    <div>Action</div>
                    <div>Space</div>
                    <div>Actor</div>
                    <div>When</div>
                  </div>
                  {events.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No governance events yet.
                    </div>
                  ) : events.map((event) => (
                    <div key={event.id} className="grid grid-cols-[2fr_2fr_2fr_2fr] p-3 items-center text-sm">
                      <div className="font-medium text-slate-900">{event.action.replaceAll("_", " ")}</div>
                      <div className="text-slate-500 truncate">{event.space_name || event.space_id}</div>
                      <div className="text-slate-500 truncate">
                        {event.actor_name || "Unknown"}
                        {event.target_name ? ` -> ${event.target_name}` : ""}
                      </div>
                      <div className="text-slate-500">{new Date(event.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
