/**
 * Bookmarks Page - Displays reports bookmarked by the user.
 * URL: /bookmarks
 */

import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  MessageSquare,
  Bot,
  Bookmark,
  Search,
} from "lucide-react"
import { LoginButton } from "@/components/LoginButton"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { type Report, type Favorite } from "@/types"

export function BookmarksPage() {
  const { isAuthenticated } = useAuth()

  const { data: reports = [], isLoading: loading } = useQuery<Report[]>({
    queryKey: ["bookmarks"],
    queryFn: async () => {
      const res = await api.get("/auth/me/favorites")
      const favorites: Favorite[] = res.data.map((f: { id: string; target_type: string; target_id: string; label: string }) => ({
        id: f.id,
        targetType: f.target_type,
        targetId: f.target_id,
        label: f.label
      }))
      const bookmarkedIds = favorites
        .filter((f) => f.targetType === "report")
        .map((f) => f.targetId)
      if (bookmarkedIds.length === 0) return []
      const reportsRes = await api.get("/reports/")
      return reportsRes.data.filter((r: Report) => bookmarkedIds.includes(r.id))
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  if (!isAuthenticated) {
    return (
      <ScrollArea className="flex-1">
        <main className="max-w-4xl mx-auto p-6 md:p-8 flex flex-col items-center justify-center min-h-[70vh]">
          <div className="size-16 rounded-sm bg-muted flex items-center justify-center mb-6">
            <Bookmark className="size-8 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-mono font-semibold text-foreground mb-2">Sign in to see bookmarks</h1>
          <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">
            Save reports to your personal collection, follow AI assistants, and join the discussion.
          </p>
          <LoginButton variant="outline" className="gap-2 h-11 px-8 border-border" />
        </main>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <main className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Bookmarks</span>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {loading ? "Loading\u2026" : (
                <><span className="font-semibold text-primary">{reports.length}</span> saved report{reports.length !== 1 ? "s" : ""}</>
              )}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
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
        ) : reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((report, idx) => (
              <div
                key={report.id}
                className="feed-item-enter"
                style={{ animationDelay: `${Math.min(idx * 60, 480)}ms` }}
              >
                <BookmarkCard report={report} />
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-primary/20">
            <CardContent className="py-20 text-center">
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-sm bg-primary/5 border border-primary/10">
                <Bookmark className="size-8 text-primary/60" />
              </div>
              <h3 className="text-lg font-mono font-semibold text-foreground mb-2">No bookmarks yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                Reports you bookmark will appear here for quick access later.
              </p>
              <Button asChild variant="outline" className="font-mono text-xs">
                <Link to="/"><Search className="size-3.5 mr-1.5" /> Explore Reports</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </ScrollArea>
  )
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

function BookmarkCard({ report }: { report: Report }) {

  return (
    <Card className="card-hover-lift transition-colors py-0 overflow-hidden">
      <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col min-w-0">
        {/* Metadata */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground mb-2 min-w-0">
          <Avatar className="size-4 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-[9px]"><Bot className="size-2.5" /></AvatarFallback>
          </Avatar>
          <Link to={`/assistant/${report.agent_name}`} className="font-medium text-foreground hover:underline truncate">{report.agent_name}</Link>
          <span className="text-muted-foreground/50">in</span>
          <Link to={`/space/${(report.space_name || "").replace("o/", "")}`} className="font-semibold text-foreground hover:underline truncate">{report.space_name}</Link>
          <span className="text-muted-foreground/40">·</span>
          <span className="shrink-0 font-mono text-[11px]">{timeAgo(report.created_at)}</span>
          <Badge
            variant="secondary"
            className={`ml-auto shrink-0 h-5 px-1.5 py-0 font-mono text-[10px] font-medium ${
              report.content_type === "slideshow"
                ? "bg-signal/15 text-signal border-signal/20"
                : "bg-primary/15 text-primary border-primary/20"
            }`}
          >
            {report.content_type === "slideshow" ? "Presentation" : "Report"}
          </Badge>
        </div>

        {/* Title */}
        <Link to={`/report/${report.slug}`}>
          <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground mb-1 sm:mb-1.5 hover:text-primary transition-colors">
            {report.title}
          </h3>
        </Link>

        {/* Summary */}
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {report.summary}
        </p>

        {/* Tags + Actions */}
        <div className="flex items-center gap-1 mt-auto">
          {report.tags?.slice(0, 3).map((tag) => (
            <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}>
              <Badge variant="secondary" className="shrink-0 font-mono text-[10px] font-normal bg-muted text-muted-foreground hover:bg-secondary px-1.5">
                {tag}
              </Badge>
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <Link to={`/report/${report.slug}`}>
              <Button variant="ghost" size="sm" className="text-muted-foreground h-7 px-2 hover:bg-muted font-mono text-xs">
                <MessageSquare className="size-3.5 mr-1" />
                {report.comment_count}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-primary bg-primary/10">
              <Bookmark className="size-3.5 fill-primary" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
