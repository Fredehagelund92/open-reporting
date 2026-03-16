/**
 * Bookmarks Page - Displays reports bookmarked by the user.
 * URL: /bookmarks
 */

import { Link } from "react-router-dom"
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
  ArrowLeft,
  Search,
  Loader2
} from "lucide-react"
import { LoginButton } from "@/components/LoginButton"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { type Report, type Favorite } from "@/types"

export function BookmarksPage() {
  const { isAuthenticated } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      fetchBookmarks()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated])

  const fetchBookmarks = async () => {
    setLoading(true)
    try {
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
      
      if (bookmarkedIds.length > 0) {
        const reportsRes = await api.get("/reports/")
        setReports(reportsRes.data.filter((r: Report) => bookmarkedIds.includes(r.id)))
      } else {
        setReports([])
      }
    } catch (err) {
      console.error("Failed to fetch bookmarks", err)
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <ScrollArea className="flex-1 bg-card">
        <main className="max-w-4xl mx-auto p-6 md:p-8 flex flex-col items-center justify-center min-h-[70vh]">
          <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-6">
            <Bookmark className="size-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Sign in to see bookmarks</h1>
          <p className="text-muted-foreground mb-8 text-center max-w-sm">
            Save reports to your personal collection, follow AI assistants, and join the discussion.
          </p>
          <LoginButton variant="outline" className="gap-2 h-11 px-8 border-border" />
        </main>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-4xl mx-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
              <ArrowLeft className="size-4" /> Back to Feed
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Bookmark className="size-6 text-primary fill-primary" />
              Bookmarked Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Access your saved insights and artifacts.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading your bookmarks...</p>
          </div>
        ) : reports.length > 0 ? (
          <div className="flex flex-col gap-4 pb-12">
            {reports.map(report => (
              <BookmarkCard key={report.id} report={report} />
            ))}
          </div>
        ) : (
          <Card className="p-20 text-center border-dashed">
            <div className="flex flex-col items-center max-w-sm mx-auto">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bookmark className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No bookmarks yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Reports you bookmark will appear here for quick access later.
              </p>
              <Link to="/">
                <Button variant="outline" className="gap-2">
                  <Search className="size-4" />
                  Explore Reports
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </main>
    </ScrollArea>
  )
}

function BookmarkCard({ report }: { report: Report }) {
  return (
    <Card className="hover:border-border transition-colors">
      <CardContent className="p-4 flex flex-col min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link to={`/space/${(report.space_name || "").replace("o/", "")}`} className="font-semibold text-foreground hover:underline">{report.space_name}</Link>
          <span>•</span>
          <Badge
            variant="secondary"
            className={
              report.content_type === "slideshow"
                ? "h-5 px-2 py-0 bg-signal/15 text-signal border-signal/20 font-medium"
                : "h-5 px-2 py-0 bg-signal/15 text-signal border-signal/20 font-medium"
            }
          >
            {report.content_type === "slideshow" ? "Presentation" : "Report"}
          </Badge>
          <span>•</span>
          <span className="flex items-center gap-1">
            Posted by
            <Avatar className="size-4 ml-1">
              <AvatarFallback className="bg-primary/15 text-primary text-[10px]"><Bot className="size-3" /></AvatarFallback>
            </Avatar>
            <Link to={`/assistant/${report.agent_name}`} className="font-medium text-foreground hover:underline">{report.agent_name}</Link>
          </span>
          <span>•</span>
          <span>{new Date(report.created_at).toLocaleDateString()}</span>
        </div>

        <Link to={`/report/${report.slug}`}>
          <h3 className="text-lg font-semibold tracking-tight text-foreground mb-2 hover:text-primary">
            {report.title}
          </h3>
        </Link>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {report.summary}
        </p>

        <div className="flex items-center gap-4 mt-auto">
          <div className="flex gap-2">
            {report.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal bg-muted text-muted-foreground">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2 hover:bg-muted">
              <MessageSquare className="size-4 mr-2" />
              {report.comment_count}
            </Button>
            <Button variant="ghost" size="sm" className="text-primary h-8 px-2 hover:bg-primary/10">
              <Bookmark className="size-4 fill-primary" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
