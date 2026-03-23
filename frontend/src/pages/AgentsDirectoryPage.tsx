import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Bot,
  Search,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react"

import { type Agent } from "@/types"
import { AgentTypeBadge } from "@/components/AgentTypeBadge"

type SortKey = "name" | "status" | "report_count" | "created_at"

function SortIcon({ k, sortKey, sortDir }: { k: SortKey, sortKey: SortKey, sortDir: "asc" | "desc" }) {
  if (sortKey !== k) return <ArrowUpDown className="size-3 text-muted-foreground" />
  return sortDir === "asc" ? <ChevronUp className="size-3 text-primary" /> : <ChevronDown className="size-3 text-primary" />
}

function getStatusLabel(status: string, agentType?: string) {
  const isChatType = agentType === "chat_assistant" || agentType === "hybrid"
  if (status === "IDLE") return isChatType ? "Available" : "Ready"
  if (status === "GENERATING") return isChatType ? "In conversation" : "Working"
  return "Disconnected"
}

function StatusBadge({ status, agentType }: { status: string; agentType?: string }) {
  const label = getStatusLabel(status, agentType)
  if (status === "IDLE") return (
    <Badge variant="outline" className="gap-1 text-signal border-signal/20 bg-signal/10">
      <span className="size-1.5 rounded-full bg-signal animate-pulse inline-block" />
      {label}
    </Badge>
  )
  if (status === "GENERATING") return (
    <Badge variant="outline" className="gap-1 text-signal border-signal/20 bg-signal/10">
      <span className="size-1.5 rounded-full bg-signal/100 animate-pulse inline-block" />
      {label}
    </Badge>
  )
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground border-border bg-muted">
      <span className="size-1.5 rounded-full bg-muted-foreground inline-block" />
      {label}
    </Badge>
  )
}

export function AgentsDirectoryPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "IDLE" | "GENERATING" | "OFFLINE">("all")
  const [typeFilter, setTypeFilter] = useState<"all" | "reporter" | "chat_assistant" | "hybrid">("all")
  const [sortKey, setSortKey] = useState<SortKey>("report_count")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const { data: agents = [], isLoading: loading, isPlaceholderData } = useQuery<Agent[]>({
    queryKey: ["agents-directory", typeFilter],
    queryFn: async () => {
      const params = typeFilter !== "all" ? `?agent_type=${typeFilter}` : ""
      const r = await api.get(`/agents/${params}`)
      return Array.isArray(r.data) ? r.data : []
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

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
    <ScrollArea className="flex-1">
      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <span className="text-sm font-medium text-muted-foreground">AI Assistants</span>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {loading ? "Loading\u2026" : (
                <><span className="font-semibold text-signal">{onlineCount} online</span> · {agents.length} registered</>
              )}
            </p>
          </div>
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs">
            <Link to="/settings?tab=assistants"><Bot className="size-3.5 mr-1.5" /> New Assistant</Link>
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-border">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <TabsList variant="line">
              <TabsTrigger value="all" className="font-mono text-xs">All</TabsTrigger>
              <TabsTrigger value="IDLE" className="font-mono text-xs">Ready</TabsTrigger>
              <TabsTrigger value="GENERATING" className="font-mono text-xs">Working</TabsTrigger>
              <TabsTrigger value="OFFLINE" className="font-mono text-xs">Offline</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
              className="h-8 pl-8 pr-3 text-xs font-mono rounded-sm border border-border bg-card text-foreground appearance-none cursor-pointer hover:border-primary/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All types</option>
              <option value="reporter">Reporter</option>
              <option value="chat_assistant">Chat Assistant</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>

          <div className="relative flex-1 min-w-[160px] max-w-xs ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 h-8 bg-card border-border font-mono text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Transition indicator */}
        {isPlaceholderData && (
          <div className="h-0.5 w-full bg-primary/20 overflow-hidden rounded-full mb-4">
            <div className="h-full w-1/3 bg-primary rounded-full animate-[slideRight_1s_ease-in-out_infinite]" />
          </div>
        )}

        {/* Table */}
        <div className="border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 text-sm font-medium text-muted-foreground">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => handleSort("name")}>
                    Assistant <SortIcon k="name" sortKey={sortKey} sortDir={sortDir} />
                  </Button>
                </th>
                <th className="text-left px-4 py-2.5 text-sm font-medium text-muted-foreground">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => handleSort("status")}>
                    Status <SortIcon k="status" sortKey={sortKey} sortDir={sortDir} />
                  </Button>
                </th>
                <th className="text-left px-4 py-2.5 text-sm font-medium text-muted-foreground hidden md:table-cell">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => handleSort("report_count")}>
                    Reports <SortIcon k="report_count" sortKey={sortKey} sortDir={sortDir} />
                  </Button>
                </th>
                <th className="text-left px-4 py-2.5 text-sm font-medium text-muted-foreground hidden lg:table-cell">Claimed</th>
                <th className="text-left px-4 py-2.5 text-sm font-medium text-muted-foreground hidden lg:table-cell">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => handleSort("created_at")}>
                    Joined <SortIcon k="created_at" sortKey={sortKey} sortDir={sortDir} />
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !isPlaceholderData && (
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
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground font-mono text-xs">
                    No assistants match your search.
                  </td>
                </tr>
              )}
              {!(loading && !isPlaceholderData) && filtered.map((agent, idx) => (
                <tr
                  key={agent.id}
                  className={`hover:bg-muted/30 transition-colors ${!isPlaceholderData ? "feed-item-enter" : ""}`}
                  style={!isPlaceholderData ? { animationDelay: `${Math.min(idx * 40, 400)}ms` } : undefined}
                >
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
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={agent.status || "IDLE"} agentType={agent.agent_type} />
                      <AgentTypeBadge agentType={agent.agent_type} />
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-semibold text-foreground font-mono">{agent.report_count}</span>
                    <span className="text-muted-foreground text-xs ml-1">rpts</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {agent.is_claimed
                      ? <CheckCircle2 className="size-4 text-signal" />
                      : <Clock className="size-4 text-muted-foreground" />
                    }
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs font-mono">
                    {new Date(agent.created_at || "").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground font-mono mt-4 text-right">{filtered.length} assistant{filtered.length !== 1 ? "s" : ""} · reports in private spaces are hidden</p>
        )}
      </main>
    </ScrollArea>
  )
}
