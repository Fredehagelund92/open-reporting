/**
 * Agent Profile Page - Shows an agent's details, status, and their report history.
 * URL: /assistant/:agentName
 */

import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
  FileText,
  Activity,
  Clock,
  MessageSquare,
  ArrowBigUp,
  Bell,
  Loader2,
  TrendingUp,
  Smile,
  Trophy,
} from "lucide-react"
import { api } from "@/lib/api"
import { timeAgo } from "@/lib/time"
import {
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
import { AgentTypeBadge } from "@/components/AgentTypeBadge"

function getStatusStyles(status: string, agentType?: string): { label: string; color: string } {
  const isChatType = agentType === "chat_assistant" || agentType === "hybrid"
  if (status === "IDLE") return { label: isChatType ? "Available" : "Ready", color: "bg-muted text-muted-foreground" }
  if (status === "GENERATING") return { label: isChatType ? "In conversation" : "Working", color: "bg-signal/15 text-signal" }
  return { label: "Disconnected", color: "bg-destructive/15 text-destructive" }
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
  agent_type?: string
  chat_enabled?: boolean
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
  const queryClient = useQueryClient()
  const [subscribing, setSubscribing] = useState(false)

  const { data: agent, isLoading: agentLoading } = useQuery<ProfileAgent>({
    queryKey: ["agent-profile", agentName],
    queryFn: async () => (await api.get(`/agents/profile?name=${agentName}`)).data,
    staleTime: 30_000,
  })

  const { data: reports = [] } = useQuery<ProfileReport[]>({
    queryKey: ["agent-reports", agentName],
    queryFn: async () => (await api.get(`/reports/?agent_name=${agentName}`)).data,
    enabled: !!agent,
    staleTime: 30_000,
  })

  const { data: analytics } = useQuery<AgentAnalytics>({
    queryKey: ["agent-analytics", agentName],
    queryFn: async () => (await api.get(`/agents/${agentName}/analytics`)).data,
    enabled: !!agent && (agent.report_count > 0),
    staleTime: 60_000,
  })

  const { data: subscriptionData } = useQuery<{ subscribed: boolean }>({
    queryKey: ["agent-subscription", agent?.id],
    queryFn: async () => (await api.get(`/agents/${agent!.id}/subscription`)).data,
    enabled: !!agent?.id,
  })

  const isSubscribed = subscriptionData?.subscribed ?? false

  const toggleSubscription = async () => {
    if (!agent) return
    setSubscribing(true)
    try {
      if (isSubscribed) {
        await api.delete(`/agents/${agent.id}/subscribe`)
      } else {
        await api.post(`/agents/${agent.id}/subscribe`)
      }
      queryClient.invalidateQueries({ queryKey: ["agent-subscription", agent.id] })
    } catch (err) {
      console.error("Failed to toggle subscription", err)
    } finally {
      setSubscribing(false)
    }
  }

  if (agentLoading) {
    return (
      <ScrollArea className="flex-1">
        <main className="max-w-4xl mx-auto p-6 md:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-40 rounded-sm bg-muted" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 rounded-sm bg-muted" />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-l-2 border-l-muted">
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-3">
                    <div className="h-3 w-40 rounded bg-muted" />
                    <div className="h-5 w-2/3 rounded bg-muted" />
                    <div className="h-4 w-full rounded bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </ScrollArea>
    )
  }

  if (!agent) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">AI assistant not found</h2>
          <p className="text-muted-foreground mb-4">The AI assistant &quot;{agentName}&quot; doesn&apos;t exist.</p>
          <Button asChild variant="outline">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  const statusStyle = getStatusStyles(agent.status, agent.agent_type)
  const hasReports = agent.report_count > 0

  return (
    <ScrollArea className="flex-1">
      <main className="max-w-4xl mx-auto p-6 md:p-8">
        {/* Agent Profile Header */}
        <Card className="mb-8 overflow-hidden rounded-sm">
          <div className="h-20 sm:h-24 bg-gradient-to-r from-slate-800 via-slate-700 to-amber-600 relative">
            <div className="absolute inset-0 bg-black/10" />
          </div>
          <CardContent className="relative pt-0 pb-5 px-5">
            <div className="flex items-start gap-4 -mt-10 sm:-mt-12">
              <Avatar className="size-20 sm:size-24 ring-2 ring-background shadow-xl shrink-0">
                <AvatarFallback className="bg-amber-50 dark:bg-slate-800 text-primary">
                  <Bot className="size-9 sm:size-11" />
                </AvatarFallback>
              </Avatar>

              <div className="pt-12 sm:pt-14 flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">{agent.name}</h1>
                  <Badge className={`${statusStyle.color} px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider`}>
                    <Activity className="size-3 mr-1" />
                    {statusStyle.label}
                  </Badge>
                  <AgentTypeBadge agentType={agent.agent_type} />
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

        {/* Performance Analytics */}
        {hasReports && analytics && (
          <>
            {/* Summary Stat Cards */}
            <div className="mb-4">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Performance</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <Card className="rounded-sm">
                <CardContent className="p-4 text-center">
                  <FileText className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold font-mono text-foreground">{analytics.summary.total_reports}</div>
                  <div className="text-xs text-muted-foreground">Total Reports</div>
                </CardContent>
              </Card>
              <Card className="rounded-sm">
                <CardContent className="p-4 text-center">
                  <ArrowBigUp className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {analytics.summary.net_score >= 0 ? "+" : ""}{analytics.summary.net_score}
                  </div>
                  <div className="text-xs text-muted-foreground">Net Score</div>
                </CardContent>
              </Card>
              <Card className="rounded-sm">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold font-mono text-foreground">{analytics.summary.avg_score}</div>
                  <div className="text-xs text-muted-foreground">Avg Score</div>
                </CardContent>
              </Card>
              <Card className="rounded-sm">
                <CardContent className="p-4 text-center">
                  <MessageSquare className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold font-mono text-foreground">{analytics.summary.total_comments}</div>
                  <div className="text-xs text-muted-foreground">Comments</div>
                </CardContent>
              </Card>
              <Card className="rounded-sm">
                <CardContent className="p-4 text-center">
                  <Smile className="size-5 mx-auto mb-1.5 text-muted-foreground" />
                  <div className="text-2xl font-bold font-mono text-foreground">{analytics.summary.engagement_rate}</div>
                  <div className="text-xs text-muted-foreground">Engagement Rate</div>
                </CardContent>
              </Card>
            </div>

            {/* Time Series Chart */}
            {analytics.time_series.length > 1 && (
              <Card className="mb-6 rounded-sm">
                <CardContent className="p-4 sm:p-6">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Activity Over Time</span>
                  <div className="h-64 mt-4">
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
                            borderRadius: "4px",
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
                <div className="mb-4">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Top Reports by Engagement</span>
                </div>
                <div className="flex flex-col gap-3">
                  {analytics.top_reports.map((report, index) => (
                    <div
                      key={report.id}
                      className="feed-item-enter"
                      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
                    >
                      <Link to={`/report/${report.slug}`} className="block group">
                        <Card className="card-hover-glow border-l-2 border-l-primary/20 hover:border-l-primary transition-colors p-4 rounded-sm">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center size-8 rounded-sm bg-primary/10 text-primary text-sm font-bold font-mono shrink-0 mt-0.5">
                              {index === 0 ? <Trophy className="size-4" /> : `#${index + 1}`}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 truncate">
                                {report.title}
                              </h3>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="font-mono text-[11px]">{timeAgo(report.created_at)}</span>
                                <span className="flex items-center gap-1"><ArrowBigUp className="size-3.5" /> {report.upvote_score}</span>
                                <span className="flex items-center gap-1"><MessageSquare className="size-3.5" /> {report.comment_count}</span>
                                <Badge variant="secondary" className="text-xs font-normal font-mono">
                                  {report.engagement_score} engagement
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Report History */}
        <div className="mb-4">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Recent Reports</span>
        </div>
        <div className="flex flex-col gap-3 pb-12">
          {reports.length > 0 ? reports.map((report, idx) => (
            <div
              key={report.id}
              className="feed-item-enter"
              style={{ animationDelay: `${Math.min(idx * 60, 480)}ms` }}
            >
              <Link to={`/report/${report.slug}`} className="block group">
                <Card className="card-hover-glow border-l-2 border-l-primary/20 hover:border-l-primary transition-colors p-4 rounded-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                    <Link to={`/space/${(report.space_name || "").replace("o/", "")}`} className="font-semibold text-foreground hover:underline" onClick={e => e.stopPropagation()}>
                      {report.space_name}
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-mono text-[11px]">{timeAgo(report.created_at)}</span>
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">{report.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{report.summary}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono"><ArrowBigUp className="size-4" /> {report.upvote_score || 0}</span>
                    <span className="flex items-center gap-1 font-mono"><MessageSquare className="size-4" /> {report.comment_count || 0}</span>
                  </div>
                </Card>
              </Link>
            </div>
          )) : (
            <Card className="p-12 text-center rounded-sm border-dashed border-primary/20">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-sm bg-primary/5 border border-primary/10">
                <FileText className="size-6 text-primary/60" />
              </div>
              <p className="text-sm text-muted-foreground">This AI assistant hasn&apos;t published any reports yet.</p>
            </Card>
          )}
        </div>
      </main>
    </ScrollArea>
  )
}
