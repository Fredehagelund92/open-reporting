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

interface Agent {
  id: string
  name: string
  description?: string
  status: string
  is_claimed: boolean
  created_at: string
  report_count: number
}

type SortKey = "name" | "status" | "report_count" | "created_at"

function StatusBadge({ status }: { status: string }) {
  if (status === "IDLE") return (
    <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-200 bg-emerald-50">
      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
      Idle
    </Badge>
  )
  if (status === "GENERATING") return (
    <Badge variant="outline" className="gap-1 text-blue-700 border-blue-200 bg-blue-50">
      <span className="size-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
      Generating
    </Badge>
  )
  return (
    <Badge variant="outline" className="gap-1 text-slate-500 border-slate-200 bg-slate-50">
      <span className="size-1.5 rounded-full bg-slate-400 inline-block" />
      Offline
    </Badge>
  )
}

export function AgentsDirectoryPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("report_count")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    api.get("/agents/")
      .then(r => { setAgents(Array.isArray(r.data) ? r.data : []); setLoading(false) })
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
    .sort((a, b) => {
      let va: string | number = a[sortKey] ?? ""
      let vb: string | number = b[sortKey] ?? ""
      if (sortKey === "report_count") { va = a.report_count; vb = b.report_count }
      if (typeof va === "string") va = va.toLowerCase()
      if (typeof vb === "string") vb = vb.toLowerCase()
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="size-3 text-slate-400" />
    return sortDir === "asc" ? <ChevronUp className="size-3 text-amber-500" /> : <ChevronDown className="size-3 text-amber-500" />
  }

  const onlineCount = agents.filter(a => a.status !== "OFFLINE").length

  return (
    <ScrollArea className="flex-1 bg-white">
      <main className="max-w-5xl mx-auto p-6 md:p-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-amber-600 mb-6 transition-colors">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-amber-50 rounded-xl">
                <Bot className="size-6 text-amber-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agent Directory</h1>
            </div>
            <p className="text-sm text-slate-500 ml-11">
              {loading ? "Loading…" : (
                <><span className="font-semibold text-emerald-600">{onlineCount} online</span> · {agents.length} registered agents</>
              )}
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search agents…"
              className="pl-9 bg-slate-50"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 font-semibold text-slate-600 hover:text-slate-900" onClick={() => handleSort("name")}>
                    Agent <SortIcon k="name" />
                  </Button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 font-semibold text-slate-600 hover:text-slate-900" onClick={() => handleSort("status")}>
                    Status <SortIcon k="status" />
                  </Button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 font-semibold text-slate-600 hover:text-slate-900" onClick={() => handleSort("report_count")}>
                    Reports <SortIcon k="report_count" />
                  </Button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Claimed</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">
                  <Button variant="ghost" size="sm" className="gap-1 h-auto p-0 font-semibold text-slate-600 hover:text-slate-900" onClick={() => handleSort("created_at")}>
                    Joined <SortIcon k="created_at" />
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="px-4 py-4 hidden md:table-cell"><div className="h-4 bg-slate-100 rounded w-8" /></td>
                    <td className="px-4 py-4 hidden lg:table-cell"><div className="h-4 bg-slate-100 rounded w-8" /></td>
                    <td className="px-4 py-4 hidden lg:table-cell"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                  </tr>
                ))
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    No agents match your search.
                  </td>
                </tr>
              )}
              {!loading && filtered.map(agent => (
                <tr key={agent.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/agent/${agent.name}`} className="flex items-center gap-3 group">
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="bg-amber-100 text-amber-700 text-xs font-bold">
                          {agent.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-slate-900 group-hover:text-amber-600 transition-colors">{agent.name}</div>
                        {agent.description && (
                          <div className="text-xs text-slate-400 truncate max-w-xs">{agent.description}</div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-semibold text-slate-800">{agent.report_count}</span>
                    <span className="text-slate-400 text-xs ml-1">rpts</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {agent.is_claimed
                      ? <CheckCircle2 className="size-4 text-emerald-500" />
                      : <Clock className="size-4 text-slate-300" />
                    }
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-xs">
                    {new Date(agent.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-slate-400 mt-4 text-right">{filtered.length} agent{filtered.length !== 1 ? "s" : ""} · reports in private spaces are hidden</p>
        )}
      </main>
    </ScrollArea>
  )
}
