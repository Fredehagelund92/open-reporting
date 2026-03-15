import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Save, Slack, Mail, Users, Bot } from "lucide-react"

export function NotificationSettings() {
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [emailPref, setEmailPref] = useState({
    enabled: true,
    events: ["report_published"]
  })
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [message, setMessage] = useState({ type: "", text: "" })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [prefRes, subRes, favRes] = await Promise.all([
        api.get("/notifications/preferences"),
        api.get("/auth/me/subscriptions"),
        api.get("/auth/me/favorites")
      ])

      const email = prefRes.data.find((p: any) => p.channel === "email")
      if (email) {
        setEmailPref({
          enabled: email.enabled,
          events: email.events || ["report_published"]
        })
      }
      
      const agentSubs = subRes.data.filter((s: any) => s.target_type === "agent")
      const spaceSubs = subRes.data.filter((s: any) => s.target_type === "space")
      const spaceFavs = favRes.data.filter((f: any) => f.target_type === "space")
      
      // Combine favorites and subscriptions for spaces (deduplicated by target_id)
      const combinedSpaces = [...spaceFavs]
      spaceSubs.forEach((sub: any) => {
        if (!combinedSpaces.find(f => f.target_id === sub.target_id)) {
          combinedSpaces.push(sub)
        }
      })
      
      setSubscriptions(agentSubs)
      setFavorites(combinedSpaces)
    } catch (err) {
      console.error("Failed to fetch notification data", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEmail = async () => {
    setIsSaving(true)
    setMessage({ type: "", text: "" })
    try {
      await api.put("/notifications/preferences", {
        channel: "email",
        enabled: emailPref.enabled,
        events: emailPref.events
      })
      setMessage({ type: "success", text: "Email preferences saved." })
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save preferences." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnfollowAgent = async (id: string) => {
    try {
      await api.delete(`/agents/${id}/subscribe`)
      setSubscriptions(subscriptions.filter(s => s.target_id !== id))
    } catch (err) {
      console.error("Failed to unfollow agent", err)
    }
  }

  const handleUnfavoriteSpace = async (id: string, label: string) => {
    try {
      await api.post("/auth/me/favorites", {
        target_type: "space",
        target_id: id,
        label: label
      })
      setFavorites(favorites.filter(f => f.target_id !== id))
    } catch (err) {
      console.error("Failed to unfollow space", err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" /> Email Notifications
          </CardTitle>
          <CardDescription>
            Receive alerts and summaries via your account email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Email Alerts</Label>
              <p className="text-xs text-muted-foreground">Turn on/off all email notifications.</p>
            </div>
            <Switch 
              checked={emailPref.enabled} 
              onCheckedChange={(val) => setEmailPref({...emailPref, enabled: val})} 
            />
          </div>

          <div className="space-y-3 pt-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Notify me when:</Label>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="event-report-email" 
                checked={emailPref.events.includes("report_published")} 
                onCheckedChange={(checked: boolean) => {
                  if (checked) {
                    setEmailPref({...emailPref, events: [...emailPref.events, "report_published"]})
                  } else {
                    setEmailPref({...emailPref, events: emailPref.events.filter(e => e !== "report_published")})
                  }
                }}
                disabled={!emailPref.enabled}
              />
              <label htmlFor="event-report-email" className="text-sm font-medium leading-none cursor-pointer">
                A new report is published in a space I follow
              </label>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t bg-muted/30 px-6 py-3 flex justify-between items-center">
          <div className="text-sm">
            {message.text && (
              <span className={message.type === "success" ? "text-signal" : "text-destructive"}>
                {message.text}
              </span>
            )}
          </div>
          <Button size="sm" onClick={handleSaveEmail} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Save Email Settings
          </Button>
        </CardFooter>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Subscription Overview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="size-4" /> Spaces 
                <Badge variant="secondary" className="ml-auto font-normal">{favorites.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {favorites.length > 0 ? (
                <div className="space-y-2">
                  {favorites.map(fav => (
                    <div key={fav.id} className="flex items-center justify-between group">
                      <span className="text-sm font-medium">{fav.label}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] text-muted-foreground hover:text-destructive"
                        onClick={() => handleUnfavoriteSpace(fav.target_id, fav.label)}
                      >
                        Unsubscribe
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">You aren't subscribed to any spaces yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="size-4" /> AI Assistants
                <Badge variant="secondary" className="ml-auto font-normal">{subscriptions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptions.length > 0 ? (
                <div className="space-y-2">
                  {subscriptions.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between group">
                      <span className="text-sm font-medium">{sub.label}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] text-muted-foreground hover:text-destructive"
                        onClick={() => handleUnfollowAgent(sub.target_id)}
                      >
                        Unsubscribe
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">You aren't subscribed to any AI assistants yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="opacity-60 grayscale">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Slack className="size-5 text-[#4A154B]" /> Slack Notifications
          </CardTitle>
          <CardDescription>
            Get instant alerts in your Slack channel via Incoming Webhooks. (Coming Soon)
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
