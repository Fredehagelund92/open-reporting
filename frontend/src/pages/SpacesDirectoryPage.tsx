import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Hash,
  Search,
  FileText,
  Users,
} from "lucide-react"

import { type Space, type SpaceStats } from "@/types"

export function SpacesDirectoryPage() {
  const [search, setSearch] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all")
  const [activityFilter, setActivityFilter] = useState<"all" | "active" | "quiet">("all")

  const { data: stats } = useQuery<SpaceStats>({
    queryKey: ["spaces-stats"],
    queryFn: async () => (await api.get("/spaces/stats")).data,
    staleTime: 60_000,
  })

  const { data: spaces = [], isLoading: loading, isPlaceholderData } = useQuery<Space[]>({
    queryKey: ["spaces-directory"],
    queryFn: async () => {
      const r = await api.get("/spaces/?sort=popularity")
      return Array.isArray(r.data) ? r.data : []
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

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
      if (activityFilter === "active") return (s.report_count || 0) > 0
      if (activityFilter === "quiet") return (s.report_count || 0) === 0
      return true
    })
    .sort((a, b) => (b.report_count || 0) - (a.report_count || 0))

  return (
    <ScrollArea className="flex-1">
      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Spaces</span>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              <span className="font-semibold text-primary">{stats?.total_spaces ?? "\u2014"}</span> spaces ·{" "}
              <span className="font-semibold text-signal">{stats?.total_reports ?? "\u2014"}</span> reports ·{" "}
              <span className="font-semibold">{stats?.total_memberships ?? "\u2014"}</span> members
            </p>
          </div>
          <div className="relative w-full max-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 h-8 bg-card border-border font-mono text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-border">
          <Tabs value={visibilityFilter} onValueChange={(v) => setVisibilityFilter(v as typeof visibilityFilter)}>
            <TabsList variant="line">
              <TabsTrigger value="all" className="font-mono text-xs">All</TabsTrigger>
              <TabsTrigger value="public" className="font-mono text-xs">Public</TabsTrigger>
              <TabsTrigger value="private" className="font-mono text-xs">Private</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={activityFilter} onValueChange={(v) => setActivityFilter(v as typeof activityFilter)}>
            <TabsList variant="line">
              <TabsTrigger value="all" className="font-mono text-xs">Any Activity</TabsTrigger>
              <TabsTrigger value="active" className="font-mono text-xs">Active</TabsTrigger>
              <TabsTrigger value="quiet" className="font-mono text-xs">Quiet</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Transition indicator */}
        {isPlaceholderData && (
          <div className="h-0.5 w-full bg-primary/20 overflow-hidden rounded-full mb-4">
            <div className="h-full w-1/3 bg-primary rounded-full animate-[slideRight_1s_ease-in-out_infinite]" />
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
          {loading && !isPlaceholderData && (
            Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-44 border rounded-sm animate-pulse bg-muted/30 border-l-2 border-l-muted" />
            ))
          )}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground font-mono text-xs">
              No spaces found matching your search.
            </div>
          )}
          {!(loading && !isPlaceholderData) && filtered.map((space, idx) => (
            <Link
              key={space.id}
              to={`/space/${space.name.replace("o/", "")}`}
              className={`group ${!isPlaceholderData ? "feed-item-enter" : ""}`}
              style={!isPlaceholderData ? { animationDelay: `${Math.min(idx * 40, 400)}ms` } : undefined}
            >
              <div className="h-full border rounded-sm p-5 bg-card hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="size-10 rounded-sm bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                    {(space.name || "").split("/")[1]?.[0]?.toUpperCase() || <Hash className="size-4" />}
                  </div>
                  {space.is_private && (
                    <Badge variant="outline" className="text-muted-foreground border-border font-mono text-[10px]">Private</Badge>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1.5 truncate">
                  {space.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                  {space.description || "No description provided."}
                </p>

                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground mt-auto border-t border-border pt-3">
                  <span className="flex items-center gap-1.5">
                    <FileText className="size-3" />
                    {space.report_count}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3" />
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
