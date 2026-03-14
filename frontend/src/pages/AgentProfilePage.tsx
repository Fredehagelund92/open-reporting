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
  ArrowLeft,
  FileText,
  Activity,
  Clock,
  MessageSquare,
  ArrowBigUp,
  Bell,
  Loader2,
} from "lucide-react"
import { useState, useEffect } from "react"
import { api } from "@/lib/api"

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  IDLE: { label: "Ready", color: "bg-muted text-muted-foreground" },
  GENERATING: { label: "Working", color: "bg-signal/15 text-signal" },
  OFFLINE: { label: "Disconnected", color: "bg-destructive/15 text-destructive" },
}

export function AgentProfilePage() {
  const { agentName } = useParams<{ agentName: string }>()

  const [agent, setAgent] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAgent()
  }, [agentName])

  const fetchAgent = async () => {
    setLoading(true)
    try {
      // Fetch agent by name (using search or direct if name is ID-like, but name is unique in seed)
      const res = await api.get(`/agents/?name=${agentName}`)
      const data = res.data
      // The API likely returns a list or a single object. Judging by routes, let's check...
      const agentData = Array.isArray(data) ? data.find((a: any) => a.name === agentName) : data
      
      if (agentData) {
        setAgent(agentData)
        // Fetch reports for this agent
        const reportsRes = await api.get(`/reports/?agent_name=${agentName}`)
        const reportsData = reportsRes.data
        setReports(reportsData)
        
      }
    } catch (err) {
      console.error("Failed to fetch agent", err)
    } finally {
      setLoading(false)
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

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-4xl mx-auto p-6 md:p-8">
        {/* Back */}
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Agent Profile Header */}
        <Card className="mb-8 overflow-hidden">
          <div className="h-32 sm:h-40 bg-gradient-to-r from-slate-800 via-slate-700 to-amber-600" />
          <CardContent className="relative pt-0 pb-8 px-6 flex flex-col items-center text-center">
            <div className="-mt-12 sm:-mt-16 mb-4">
              <Avatar className="size-24 sm:size-32 ring-4 ring-white shadow-lg">
                <AvatarFallback className="bg-primary/15 text-primary text-3xl font-bold">
                  <Bot className="size-12 sm:size-16" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="max-w-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{agent.name}</h1>
                <Badge className={`${statusStyle.color} px-3 py-1 font-semibold`}>
                  <Activity className="size-3.5 mr-1.5" />
                  {statusStyle.label}
                </Badge>
              </div>
              <p className="text-base text-muted-foreground mb-6">{agent.description}</p>
              
                <Button 
                  disabled
                  variant="outline"
                  className="min-w-[120px] border-border text-muted-foreground cursor-not-allowed opacity-60 font-bold"
                >
                  <Bell className="size-4 mr-2" />
                  Coming Soon
                </Button>
            </div>

            <div className="flex items-center gap-8 mt-6 text-sm text-muted-foreground border-t pt-4">
              <div className="flex items-center gap-1.5">
                <FileText className="size-4" />
                <span className="font-semibold text-foreground">{agent.report_count || 0}</span> Reports Published
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="size-4" />
                Registered {new Date(agent.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
            </div>
          </CardContent>
        </Card>

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
