/**
 * Space Settings Page - Allows owners and admins to manage a space.
 * URL: /space/:spaceName/settings
 */

import { useState, useEffect, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  ArrowLeft,
  Settings,
  Trash2,
  Save,
  UserPlus,
  Loader2,
  ChevronRight,
  Globe,
  Lock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { api } from "@/lib/api"

interface SpaceRecord {
  id: string
  name: string
  description: string | null
  is_private: boolean
  owner_id: string | null
}

interface SpaceMember {
  user_id: string
  user_name: string
  user_email: string
  granted_at: string
}

interface GovernanceEvent {
  id: string
  action: string
  actor_name: string | null
  target_name: string | null
  created_at: string
}

interface ApiErrorLike {
  response?: {
    data?: {
      detail?: string
    }
  }
}

export function SpaceSettingsPage() {
  const { spaceName } = useParams<{ spaceName: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [space, setSpace] = useState<SpaceRecord | null>(null)
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [events, setEvents] = useState<GovernanceEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [fatalError, setFatalError] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")

  const getErrorMessage = (err: unknown, fallback: string) => {
    const e = err as ApiErrorLike
    return e.response?.data?.detail || fallback
  }

  const fetchSpaceData = useCallback(async () => {
    setIsLoading(true)
    setFatalError("")
    try {
      const res = await api.get("/spaces/")
      const foundSpace = (res.data as SpaceRecord[]).find((s) => s.name.replace("o/", "") === spaceName)

      if (!foundSpace) {
        setSpace(null)
        setFatalError("Space not found or you no longer have access.")
        return
      }

      setSpace(foundSpace)
      setName(foundSpace.name)
      setDescription(foundSpace.description || "")
      setIsPrivate(foundSpace.is_private)

      const allowed = user?.role === "ADMIN" || foundSpace.owner_id === user?.id
      setCanManage(Boolean(allowed))

      if (foundSpace.is_private && allowed) {
        try {
          const accessRes = await api.get(`/spaces/${foundSpace.id}/access`)
          setMembers(accessRes.data)
        } catch {
          setMembers([])
        }
      } else {
        setMembers([])
      }

      if (allowed) {
        try {
          const eventsRes = await api.get(`/spaces/${foundSpace.id}/governance-events?limit=20`)
          setEvents(eventsRes.data)
        } catch {
          setEvents([])
        }
      } else {
        setEvents([])
      }
    } catch (err) {
      setFatalError(getErrorMessage(err, "Could not load space settings."))
    } finally {
      setIsLoading(false)
    }
  }, [spaceName, user?.id, user?.role])

  useEffect(() => {
    fetchSpaceData()
  }, [fetchSpaceData])

  const handleUpdateSpace = async () => {
    if (!space || !canManage) return
    setIsSaving(true)
    setMessage(null)
    try {
      await api.patch(`/spaces/${space.id}`, { name, description, is_private: isPrivate })
      setMessage({ type: "success", text: "Space settings saved." })
      const nextPath = `/space/${name.replace("o/", "")}/settings`
      await fetchSpaceData()
      if (space.name !== name) {
        navigate(nextPath)
      }
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err, "Failed to save changes.") })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSpace = async () => {
    if (!space || !canManage) return
    if (!confirm(`Are you sure you want to delete ${space.name}? This action is irreversible.`)) return
    try {
      await api.delete(`/spaces/${space.id}`)
      window.dispatchEvent(new CustomEvent("refresh-sidebar"))
      navigate("/spaces")
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err, "Failed to delete space.") })
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail || !space || !canManage) return
    setIsSaving(true)
    setMessage(null)
    try {
      await api.post(`/spaces/${space.id}/invite`, { user_email: inviteEmail })
      setInviteEmail("")
      setMessage({ type: "success", text: "Member invited." })
      await fetchSpaceData()
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err, "Could not invite that user.") })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRevoke = async (userId: string) => {
    if (!space || !canManage) return
    setMessage(null)
    try {
      await api.delete(`/spaces/${space.id}/access/${userId}`)
      setMembers((prev) => prev.filter((m) => m.user_id !== userId))
      setMessage({ type: "success", text: "Member access revoked." })
      await fetchSpaceData()
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err, "Could not revoke member access.") })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (fatalError || !space) {
    return (
      <div className="flex-1 bg-muted/50 p-6 md:p-10 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-lg text-destructive flex items-center gap-2">
                <AlertCircle className="size-5" /> Could not open settings
              </CardTitle>
              <CardDescription>{fatalError || "This space is unavailable."}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/spaces">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 size-4" /> Back to Spaces
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-muted/50 p-6 md:p-10 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to={`/space/${spaceName}`} className="hover:text-primary">o/{spaceName}</Link>
          <ChevronRight className="size-3" />
          <span className="text-foreground font-medium">Settings</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Settings className="size-8 text-primary" />
              Space Settings
            </h1>
            <p className="text-muted-foreground mt-1">Manage configuration and access for this space.</p>
          </div>
          <Link to={`/space/${spaceName}`}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 size-4" /> Back to Space
            </Button>
          </Link>
        </div>

        {!canManage && (
          <Card className="mb-6 border-destructive/20 bg-destructive/10/30">
            <CardContent className="py-4 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="size-4" />
              You can view this page, but only the space owner or an admin can manage settings.
            </CardContent>
          </Card>
        )}

        {message && (
          <Card className={`mb-6 ${message.type === "success" ? "border-signal/20 bg-signal/10/40" : "border-destructive/20 bg-destructive/10/30"}`}>
            <CardContent className={`py-3 text-sm flex items-center gap-2 ${message.type === "success" ? "text-signal" : "text-destructive"}`}>
              {message.type === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
              {message.text}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-8 pb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">General Information</CardTitle>
              <CardDescription>Update the name and purpose of this space.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Space Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. o/marketing"
                  disabled={!canManage}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this space for?"
                  rows={3}
                  disabled={!canManage}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Private Space</Label>
                    {isPrivate ? <Lock className="size-3.5 text-primary" /> : <Globe className="size-3.5 text-signal" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Private spaces are only visible to members you invite.
                  </p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} disabled={!canManage} />
              </div>

              <div className="flex justify-end border-t pt-6">
                <Button onClick={handleUpdateSpace} disabled={isSaving || !canManage} className="bg-primary hover:bg-primary/90 text-white">
                  {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={!isPrivate ? "opacity-70" : ""}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Manage Members</span>
                {!isPrivate && <Badge variant="secondary" className="font-normal">Public spaces don't need invites</Badge>}
              </CardTitle>
              <CardDescription>Control who can view and participate in this space.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-6">
                <Input
                  placeholder="user@company.io"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={!isPrivate || !canManage}
                />
                <Button onClick={handleInvite} disabled={!isPrivate || !canManage || isSaving} className="bg-foreground border-border text-white hover:bg-foreground">
                  <UserPlus className="mr-2 size-4" /> Invite
                </Button>
              </div>

              <div className="border rounded-md divide-y">
                <div className="grid grid-cols-[1.5fr_2fr_1fr_0.5fr] p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                  <div>User</div>
                  <div>Email</div>
                  <div>Granted</div>
                  <div className="text-right">Action</div>
                </div>
                {members.length > 0 ? members.map((m) => (
                  <div key={m.user_id} className="grid grid-cols-[1.5fr_2fr_1fr_0.5fr] p-3 items-center text-sm">
                    <div className="font-medium text-foreground truncate">{m.user_name}</div>
                    <div className="text-muted-foreground truncate">{m.user_email}</div>
                    <div className="text-xs text-muted-foreground">{new Date(m.granted_at).toLocaleDateString()}</div>
                    <div className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                        disabled={!canManage}
                        onClick={() => handleRevoke(m.user_id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No members yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Governance Activity</CardTitle>
              <CardDescription>Recent management actions for this space.</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No governance events yet.</p>
              ) : (
                <div className="divide-y border rounded-md">
                  {events.map((event) => (
                    <div key={event.id} className="p-3 text-sm flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{event.action.replaceAll("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.actor_name || "Unknown"}{event.target_name ? ` -> ${event.target_name}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/10/10">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible administrative actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between border-t border-red-100 pt-6">
                <div>
                  <h4 className="font-semibold text-foreground">Delete this space</h4>
                  <p className="text-sm text-muted-foreground">Once deleted, all reports and discussions will be lost.</p>
                </div>
                <Button onClick={handleDeleteSpace} variant="destructive" disabled={!canManage}>
                  <Trash2 className="mr-2 size-4" /> Delete Space
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
