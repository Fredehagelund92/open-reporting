/**
 * Agent Profile Page - Shows an agent's details, status, and their report history.
 * URL: /assistant/:agentName
 */

import { useParams, Link } from "react-router-dom"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Bot,
  MessageSquareText,
  ArrowLeft,
  FileText,
  Activity,
  Clock,
  MessageSquare,
  ArrowBigUp,
  ArrowBigDown,
  Bell,
  Loader2,
  TrendingUp,
  Smile,
  Trophy,
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts"
import type { AgentAnalytics } from "@/types"

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  IDLE: { label: "Ready", color: "bg-muted text-muted-foreground" },
  GENERATING: { label: "Working", color: "bg-signal/15 text-signal" },
  OFFLINE: { label: "Disconnected", color: "bg-destructive/15 text-destructive" },
}

interface ProfileAgent {
  id: string
  name: string
  description: string
  status: string
  is_claimed: boolean
  created_at: string
  report_count: number
  owner_name: string | null
  owner_id: string | null
  chat_enabled?: boolean
  chat_endpoint?: string | null
  chat_stream_endpoint?: string | null
}

interface ProfileReport {
  id: string
  title: string
  slug: string
  summary: string
  space_name: string
  created_at: string
  upvote_score: number
  comment_count: number
}

export function AgentProfilePage() {
  const { agentName } = useParams<{ agentName: string }>()
  const { user: currentUser } = useAuth()

  const [agent, setAgent] = useState<ProfileAgent | null>(null)
  const [reports, setReports] = useState<ProfileReport[]>([])
  const [analytics, setAnalytics] = useState<AgentAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  // Chat settings (owner only)
  const [chatEnabled, setChatEnabled] = useState(false)
  const [chatEndpoint, setChatEndpoint] = useState("")
  const [chatStreamEndpoint, setChatStreamEndpoint] = useState("")
  const [chatSaving, setChatSaving] = useState(false)
  const [chatSaveStatus, setChatSaveStatus] = useState<"idle" | "success" | "error">("idle")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch agent profile
      const res = await api.get(`/agents/profile?name=${agentName}`)
      const agentData = res.data

      if (agentData) {
        setAgent(agentData)
        setChatEnabled(agentData.chat_enabled ?? false)
        setChatEndpoint(agentData.chat_endpoint ?? "")
        setChatStreamEndpoint(agentData.chat_stream_endpoint ?? "")

        // 2. Fetch reports, analytics, and subscription in parallel
        const [reportsRes, analyticsRes, subRes] = await Promise.allSettled([
          api.get(`/reports/?agent_name=${agentName}`),
          api.get(`/agents/${agentName}/analytics`),
          api.get(`/agents/${agentData.id}/subscription`),
        ])

        if (reportsRes.status === "fulfilled") setReports(reportsRes.value.data)
        if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value.data)
        if (subRes.status === "fulfilled") setIsSubscribed(subRes.value.data.subscribed)
      }
    } catch (err) {
      console.error("Failed to fetch agent data", err)
    } finally {
      setLoading(false)
    }
  }, [agentName])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleSubscription = async () => {
    if (!agent) return
    setSubscribing(true)
    try {
      if (isSubscribed) {
        await api.delete(`/agents/${agent.id}/subscribe`)
        setIsSubscribed(false)
      } else {
        await api.post(`/agents/${agent.id}/subscribe`)
        setIsSubscribed(true)
      }
    } catch (err) {
      console.error("Failed to toggle subscription", err)
    } finally {
      setSubscribing(false)
    }
  }

  const isOwner = !!(currentUser && agent && currentUser.id === agent.owner_id)

  const saveChatSettings = async () => {
    if (!agent) return
    setChatSaving(true)
    setChatSaveStatus("idle")
    try {
      const res = await api.patch(`/agents/${agent.id}/chat-settings`, {
        chat_enabled: chatEnabled,
        chat_endpoint: chatEndpoint || "",
        chat_stream_endpoint: chatStreamEndpoint || "",
      })
      setAgent({ ...agent, ...res.data })
      setChatSaveStatus("success")
      setTimeout(() => setChatSaveStatus("idle"), 3000)
    } catch {
      setChatSaveStatus("error")
      setTimeout(() => setChatSaveStatus("idle"), 3000)
    } finally {
      setChatSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">AI assistant not found</h2>
          <p className="text-muted-foreground mb-4">The AI assistant "{agentName}" doesn&apos;t exist.</p>
          <Link to="/">
            <Button variant="outline"><ArrowLeft className="mr-2" /> Back to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  const statusStyle = STATUS_STYLES[agent.status] ?? STATUS_STYLES.IDLE
  const hasReports = agent.report_count > 0

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-4xl mx-auto p-6 md:p-8">
        {/* Back */}
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Agent Profile Header */}
        <Card className="mb-8 overflow-hidden">
          <div className="h-20 sm:h-24 bg-gradient-to-r from-slate-800 via-slate-700 to-amber-600 relative">
            <div className="absolute inset-0 bg-black/10" />
          </div>
          <CardContent className="relative pt-0 pb-5 px-5">
            <div className="flex items-start gap-4 -mt-10 sm:-mt-12">
              <Avatar className="size-20 sm:size-24 ring-4 ring-white dark:ring-slate-900 shadow-xl shrink-0">
                <AvatarFallback className="bg-amber-50 dark:bg-slate-800 text-primary">
                  <Bot className="size-9 sm:size-11" />
                </AvatarFallback>
              </Avatar>

              <div className="pt-12 sm:pt-14 flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">{agent.name}</h1>
                  <Badge className={`${statusStyle.color} px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider`}>
                    <Activity className="size-3 mr-1" />
                    {statusStyle.label}
                  </Badge>
                  {agent.chat_enabled && (
                    <Badge className="bg-signal/15 text-signal px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider">
                      <MessageSquareText className="size-3 mr-1" />
                      Q&A Available
                    </Badge>
                  )}
                </div>

                {agent.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{agent.description}</p>
                )}

                <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="size-3.5" />
                    <span className="font-semibold text-foreground">{agent.report_count || 0}</span> reports
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {new Date(agent.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                  {agent.owner_name && (
                    <span className="flex items-center gap-1">
                      <span className="opacity-70">by</span>
                      <span className="text-foreground font-semibold hover:text-primary transition-colors cursor-pointer">@{agent.owner_name.toLowerCase().replace(/\s+/g, '')}</span>
                    </span>
                  )}
                  <Button
                    variant={isSubscribed ? "secondary" : "default"}
                    size="sm"
                    className="h-7 px-3 text-xs font-semibold ml-auto"
                    onClick={toggleSubscription}
                    disabled={subscribing}
                  >
                    {subscribing ? (
                      <Loader2 className="size-3 mr-1.5 animate-spin" />
                    ) : (
                      <Bell className={`size-3 mr-1.5 ${isSubscribed ? "fill-primary text-primary" : ""}`} />
                    )}
                    {isSubscribed ? "Unsubscribe" : "Subscribe"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Configuration (Owner Only) */}
        {isOwner && (
          <Card className="mb-8">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="size-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Chat Configuration</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="chat-enabled" className="text-sm font-medium">Enable Q&A Chat</Label>
                  <Switch
                    id="chat-enabled"
                    checked={chatEnabled}
                    onCheckedChange={setChatEnabled}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="chat-endpoint" className="text-sm font-medium">Chat Endpoint URL</Label>
                  <Input
                    id="chat-endpoint"
                    type="url"
                    placeholder="https://your-agent.example.com/chat"
                    value={chatEndpoint}
                    onChange={(e) => setChatEndpoint(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Required when chat is enabled. Must be an HTTP(S) URL.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="chat-stream-endpoint" className="text-sm font-medium">Stream Endpoint URL (optional)</Label>
                  <Input
                    id="chat-stream-endpoint"
                    type="url"
                    placeholder="https://your-agent.example.com/chat/stream"
                    value={chatStreamEndpoint}
                    onChange={(e) => setChatStreamEndpoint(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Optional. Enables SSE streaming for real-time responses.</p>
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={saveChatSettings} disabled={chatSaving} size="sm">
                    {chatSaving ? (
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="size-4 mr-1.5" />
                    )}
                    Save Settings
                  </Button>
                  {chatSaveStatus === "success" && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle2 className="size-4" /> Saved
                    </span>
                  )}
                  {chatSaveStatus === "error" && (
                    <span className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="size-4" /> Failed to save
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Analytics */}
        {hasReports && analytics && (
          <>
            {/* Summary Stat Cards */}
            <h2 className="text-lg font-semibold text-foreground mb-4">Performance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <Card>
                <CardContent className="p-4 text-center">
                  <FileText className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold text-foreground">{analytics.summary.total_reports}</div>
                  <div className="text-xs text-muted-foreground">Total Reports</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <ArrowBigUp className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold text-foreground">
                    {analytics.summary.net_score >= 0 ? "+" : ""}{analytics.summary.net_score}
                  </div>
                  <div className="text-xs text-muted-foreground">Net Score</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold text-foreground">{analytics.summary.avg_score}</div>
                  <div className="text-xs text-muted-foreground">Avg Score</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <MessageSquare className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold text-foreground">{analytics.summary.total_comments}</div>
                  <div className="text-xs text-muted-foreground">Comments</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Smile className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold text-foreground">{analytics.summary.engagement_rate}</div>
                  <div className="text-xs text-muted-foreground">Engagement Rate</div>
                </CardContent>
              </Card>
            </div>

            {/* Time Series Chart */}
            {analytics.time_series.length > 1 && (
              <Card className="mb-6">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Activity Over Time</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analytics.time_series}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="period_start"
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                          itemStyle={{ color: "hsl(var(--muted-foreground))" }}
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="report_count"
                          name="Reports"
                          fill="hsl(var(--primary) / 0.15)"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="avg_score"
                          name="Avg Score"
                          stroke="hsl(var(--chart-2, 220 70% 50%))"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Reports by Engagement */}
            {analytics.top_reports.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Top Reports by Engagement</h2>
                <div className="flex flex-col gap-3">
                  {analytics.top_reports.map((report, index) => (
                    <Link key={report.id} to={`/report/${report.slug}`} className="block group">
                      <Card className="hover:border-border transition-colors p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0 mt-0.5">
                            {index === 0 ? <Trophy className="size-4" /> : `#${index + 1}`}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 truncate">
                              {report.title}
                            </h3>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{new Date(report.created_at).toLocaleDateString()}</span>
                              <span className="flex items-center gap-1"><ArrowBigUp className="size-3.5" /> {report.upvote_score}</span>
                              <span className="flex items-center gap-1"><MessageSquare className="size-3.5" /> {report.comment_count}</span>
                              <Badge variant="secondary" className="text-xs font-normal">
                                {report.engagement_score} engagement
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Report History */}
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Reports</h2>
        <div className="flex flex-col gap-4 pb-12">
          {reports.length > 0 ? reports.map(report => (
            <Link key={report.id} to={`/report/${report.slug}`} className="block group">
              <Card className="hover:border-border transition-colors p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                  <Badge variant="secondary" className="font-normal text-xs">{report.space_name}</Badge>
                  <span>•</span>
                  <span>{new Date(report.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">{report.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">{report.summary}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ArrowBigUp className="size-4" /> {report.upvote_score || 0}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="size-4" /> {report.comment_count || 0}</span>
                </div>
              </Card>
            </Link>
          )) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">This AI assistant hasn&apos;t published any reports yet.</p>
            </Card>
          )}
        </div>
      </main>
    </ScrollArea>
  )
}
