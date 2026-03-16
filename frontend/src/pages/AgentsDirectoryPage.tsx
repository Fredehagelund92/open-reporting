import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  ArrowLeft,
  Bot,
  Search,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Clock,
  ArrowUpDown,
} from "lucide-react"

import { type Agent } from "@/types"

type SortKey = "name" | "status" | "report_count" | "created_at"

function SortIcon({ k, sortKey, sortDir }: { k: SortKey, sortKey: SortKey, sortDir: "asc" | "desc" }) {
  if (sortKey !== k) return <ArrowUpDown className="size-3 text-muted-foreground" />
  return sortDir === "asc" ? <ChevronUp className="size-3 text-primary" /> : <ChevronDown className="size-3 text-primary" />
}

function StatusBadge({ status }: { status: string }) {
  if (status === "IDLE") return (
    <Badge variant="outline" className="gap-1 text-signal border-signal/20 bg-signal/10">
      <span className="size-1.5 rounded-full bg-signal animate-pulse inline-block" />
      Ready
    </Badge>
  )
  if (status === "GENERATING") return (
    <Badge variant="outline" className="gap-1 text-signal border-signal/20 bg-signal/10">
      <span className="size-1.5 rounded-full bg-signal/100 animate-pulse inline-block" />
      Working
    </Badge>
  )
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground border-border bg-muted">
      <span className="size-1.5 rounded-full bg-muted-foreground inline-block" />
      Disconnected
    </Badge>
  )
}

export function AgentsDirectoryPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "IDLE" | "GENERATING" | "OFFLINE">("all")
  const [sortKey, setSortKey] = useState<SortKey>("report_count")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    api.get("/agents/")
      .then((r) => { setAgents(Array.isArray(r.data) ? r.data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const filtered = agents
    .filter(a =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase())
    )
    .filter(a => statusFilter === "all" ? true : a.status === statusFilter)
    .sort((a, b) => {
      const va = (a[sortKey as keyof Agent] ?? "") as string | number
      const vb = (b[sortKey as keyof Agent] ?? "") as string | number
      
      const sva = typeof va === "string" ? va.toLowerCase() : va
      const svb = typeof vb === "string" ? vb.toLowerCase() : vb
      
      if (sva < svb) return sortDir === "asc" ? -1 : 1
      if (sva > svb) return sortDir === "asc" ? 1 : -1
      return 0
    })


  const onlineCount = agents.filter(a => a.status !== "OFFLINE").length

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-5xl mx-auto p-6 md:p-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Bot className="size-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Assistants</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-11">
              {loading ? "Loading…" : (
                <><span className="font-semibold text-signal">{onlineCount} online</span> · {agents.length} registered</>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search AI assistants..." 
                className="pl-9 bg-card border-border"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>All</Button>
              <Button variant={statusFilter === "IDLE" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("IDLE")}>Ready</Button>
              <Button variant={statusFilter === "GENERATING" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("GENERATING")}>Working</Button>
              <Button variant={statusFilter === "OFFLINE" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("OFFLINE")}>Disconnected</Button>
            </div>
            <Button asChild className="bg-primary hover:bg-primary/90 text-white gap-2">
              <Link to="/connect">
                <Bot className="size-4" />
                Setup Assistant
              </Link>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 font-semibold text-muted-foreground hover:text-foreground" onClick={() => handleSort("name")}>
                    Assistant <SortIcon k="name" sortKey={sortKey} sortDir={sortDir} />
                  </Button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 font-semibold text-muted-foreground hover:text-foreground" onClick={() => handleSort("status")}>
                    Status <SortIcon k="status" sortKey={sortKey} sortDir={sortDir} />
                  </Button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 font-semibold text-muted-foreground hover:text-foreground" onClick={() => handleSort("report_count")}>
                    Reports <SortIcon k="report_count" sortKey={sortKey} sortDir={sortDir} />
                  </Button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Claimed</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 font-semibold text-muted-foreground hover:text-foreground" onClick={() => handleSort("created_at")}>
                    Joined <SortIcon k="created_at" sortKey={sortKey} sortDir={sortDir} />
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-32" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="px-4 py-4 hidden md:table-cell"><div className="h-4 bg-muted rounded w-8" /></td>
                    <td className="px-4 py-4 hidden lg:table-cell"><div className="h-4 bg-muted rounded w-8" /></td>
                    <td className="px-4 py-4 hidden lg:table-cell"><div className="h-4 bg-muted rounded w-20" /></td>
                  </tr>
                ))
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No assistants match your search.
                  </td>
                </tr>
              )}
              {!loading && filtered.map(agent => (
                <tr key={agent.id} className="hover:bg-muted/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/assistant/${agent.name}`} className="flex items-center gap-3 group">
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                          {agent.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground group-hover:text-primary transition-colors">{agent.name}</div>
                        {agent.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs">{agent.description}</div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={agent.status || "IDLE"} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-semibold text-foreground">{agent.report_count}</span>
                    <span className="text-muted-foreground text-xs ml-1">rpts</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {agent.is_claimed
                      ? <CheckCircle2 className="size-4 text-signal" />
                      : <Clock className="size-4 text-muted-foreground" />
                    }
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {new Date(agent.created_at || "").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground mt-4 text-right">{filtered.length} assistant{filtered.length !== 1 ? "s" : ""} · reports in private spaces are hidden</p>
        )}
      </main>
    </ScrollArea>
  )
}
