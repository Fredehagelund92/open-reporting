import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Hash,
  Search,
  FileText,
  Users,
} from "lucide-react"

interface Space {
  id: string
  name: string
  description?: string
  is_private: boolean
  owner_id?: string
  created_at: string
  report_count: number
  member_count: number
}

interface SpaceStats {
  total_spaces: number
  total_reports: number
  total_memberships: number
}


export function SpacesDirectoryPage() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [stats, setStats] = useState<SpaceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all")
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "quiet">("all")

  useEffect(() => {
    // Fetch stats
    api.get("/spaces/stats")
      .then((r: any) => setStats(r.data))
      .catch(err => console.error("Failed to fetch stats", err))

    // Fetch spaces
    api.get("/spaces/?sort=popularity")
      .then((r: any) => { 
        setSpaces(Array.isArray(r.data) ? r.data : []); 
        setLoading(false);
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = spaces
    .filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(search.toLowerCase())
    )
    .filter(s => {
      if (visibilityFilter === "public") return !s.is_private
      if (visibilityFilter === "private") return s.is_private
      return true
    })
    .filter(s => {
      if (activityFilter === "active") return s.report_count > 0
      if (activityFilter === "quiet") return s.report_count === 0
      return true
    })
    .sort((a, b) => b.report_count - a.report_count)


  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-5xl mx-auto p-6 md:p-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/15/50">
              <Hash className="size-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">Explore Spaces</h1>
              
              {/* Subtle Analytics */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-primary">{stats?.total_spaces.toLocaleString() || "—"}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Communities</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-signal">{stats?.total_reports.toLocaleString() || "—"}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reports</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-signal">{stats?.total_memberships.toLocaleString() || "—"}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Memberships</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Search spaces..." 
              className="pl-9 bg-card border-border h-11 rounded-xl shadow-sm focus:ring-primary/20"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Button variant={visibilityFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setVisibilityFilter("all")}>
            All Visibility
          </Button>
          <Button variant={visibilityFilter === "public" ? "default" : "outline"} size="sm" onClick={() => setVisibilityFilter("public")}>
            Public
          </Button>
          <Button variant={visibilityFilter === "private" ? "default" : "outline"} size="sm" onClick={() => setVisibilityFilter("private")}>
            Private
          </Button>
          <Button variant={activityFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setActivityFilter("all")}>
            All Activity
          </Button>
          <Button variant={activityFilter === "active" ? "default" : "outline"} size="sm" onClick={() => setActivityFilter("active")}>
            Active
          </Button>
          <Button variant={activityFilter === "quiet" ? "default" : "outline"} size="sm" onClick={() => setActivityFilter("quiet")}>
            Quiet
          </Button>
        </div>

        {/* Directory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
          {loading && (
            Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-48 border rounded-xl animate-pulse bg-muted" />
            ))
          )}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground">
              No spaces found matching your search.
            </div>
          )}
          {!loading && filtered.map(space => (
            <Link 
              key={space.id} 
              to={`/space/${space.name.replace("o/", "")}`}
              className="group"
            >
              <div className="h-full border rounded-xl p-6 bg-card hover:border-primary/30 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className={`size-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:scale-105 transition-transform`}>
                    {space.name.split("/")[1]?.[0]?.toUpperCase() || "#"}
                  </div>
                  {space.is_private && (
                    <Badge variant="outline" className="text-muted-foreground border-border">Private</Badge>
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-2 truncate">
                  {space.name}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">
                  {space.description || "No description provided."}
                </p>

                <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground mt-auto border-t pt-4">
                  <span className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors">
                    <FileText className="size-3.5" />
                    {space.report_count}
                  </span>
                  <span className="flex items-center gap-1.5 hover:text-muted-foreground transition-colors">
                    <Users className="size-3.5" />
                    {space.member_count}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </ScrollArea>
  )
}
