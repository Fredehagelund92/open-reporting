/**
 * Space Settings Page - Allows owners and admins to manage a space.
 * URL: /space/:spaceName/settings
 */

import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
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
} from "lucide-react"
import { MOCK_SPACES } from "@/data/mock"
import { api } from "@/lib/api"

export function SpaceSettingsPage() {
  const { spaceName } = useParams<{ spaceName: string }>()
  const navigate = useNavigate()

  // Find space by name (mock data for initial load)
  const mockSpace = MOCK_SPACES.find(s => s.name.replace("o/", "") === spaceName)
  
  const [space, setSpace] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")

  useEffect(() => {
    fetchSpaceData()
  }, [spaceName])

  const fetchSpaceData = async () => {
    setIsLoading(true)
    try {
      // In real app, fetch from backend by name
      // const res = await api.get(`/spaces/name/${spaceName}`)
      // For now, use mock or find in list
      const actualSpace = mockSpace as any || { id: "unknown", name: "o/" + spaceName, description: "", isPrivate: false }
      setSpace(actualSpace)
      setName(actualSpace.name)
      setDescription(actualSpace.description || "")
      setIsPrivate(actualSpace.isPrivate || actualSpace.is_private || false)
      
      // Fetch members if private
      if (actualSpace.isPrivate || actualSpace.is_private) {
        // const resSub = await api.get(`/spaces/${actualSpace.id}/access`)
        // setMembers(resSub.data)
        setMembers([
          { user_id: "u1", user_name: "Alex PM", user_email: "alex@company.io", granted_at: new Date().toISOString() }
        ])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateSpace = async () => {
    setIsSaving(true)
    try {
      await api.patch(`/spaces/${space.id}`, { name, description, is_private: isPrivate })
      // Success logic: notify user or just stay on page
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSpace = async () => {
    if (!confirm(`Are you sure you want to delete ${space.name}? This action is irreversible.`)) return
    
    try {
      await api.delete(`/spaces/${space.id}`)
      navigate("/")
    } catch (err) {
      console.error(err)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail) return
    try {
      await api.post(`/spaces/${space.id}/invite`, { user_email: inviteEmail })
      setInviteEmail("")
      fetchSpaceData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleRevoke = async (userId: string) => {
    try {
      await api.delete(`/spaces/${space.id}/access/${userId}`)
      fetchSpaceData()
    } catch (err) {
      console.error(err)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 bg-slate-50/50 p-6 md:p-10 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to={`/space/${spaceName}`} className="hover:text-amber-600">o/{spaceName}</Link>
          <ChevronRight className="size-3" />
          <span className="text-slate-900 font-medium">Settings</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <Settings className="size-8 text-amber-500" />
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

        <div className="grid gap-8 pb-12">
          {/* General Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">General Information</CardTitle>
              <CardDescription>Update the name and purpose of this space.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Space Name</Label>
                <div className="flex gap-2">
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. o/marketing"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this space for?"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Private Space</Label>
                    {isPrivate ? <Lock className="size-3.5 text-amber-600" /> : <Globe className="size-3.5 text-emerald-600" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Private spaces are only visible to members you invite.
                  </p>
                </div>
                <Switch 
                  checked={isPrivate} 
                  onCheckedChange={setIsPrivate} 
                />
              </div>

              <div className="flex justify-end border-t pt-6">
                <Button onClick={handleUpdateSpace} disabled={isSaving} className="bg-amber-500 hover:bg-amber-600 text-white">
                  {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Member Management */}
          <Card className={!isPrivate ? "opacity-50 pointer-events-none grayscale" : ""}>
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
                />
                <Button onClick={handleInvite} className="bg-slate-900 border-slate-800 text-white hover:bg-slate-800">
                  <UserPlus className="mr-2 size-4" /> Invite
                </Button>
              </div>

              <div className="border rounded-md divide-y">
                <div className="grid grid-cols-[1.5fr_2fr_1fr_0.5fr] p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <div>User</div>
                  <div>Email</div>
                  <div>Granted</div>
                  <div className="text-right">Action</div>
                </div>
                {members.length > 0 ? members.map(m => (
                  <div key={m.user_id} className="grid grid-cols-[1.5fr_2fr_1fr_0.5fr] p-3 items-center text-sm">
                    <div className="font-medium text-slate-900 truncate">{m.user_name}</div>
                    <div className="text-muted-foreground truncate">{m.user_email}</div>
                    <div className="text-xs text-muted-foreground">{new Date(m.granted_at).toLocaleDateString()}</div>
                    <div className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
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

          {/* Danger Zone */}
          <Card className="border-red-200 bg-red-50/10">
            <CardHeader>
              <CardTitle className="text-lg text-red-700">Danger Zone</CardTitle>
              <CardDescription>Irreversible administrative actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between border-t border-red-100 pt-6">
                <div>
                  <h4 className="font-semibold text-slate-900">Delete this space</h4>
                  <p className="text-sm text-muted-foreground">Once deleted, all reports and discussions will be lost.</p>
                </div>
                <Button onClick={handleDeleteSpace} variant="destructive">
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
