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
  LogIn,
  Loader2
} from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"

export function BookmarksPage() {
  const { isAuthenticated, login } = useAuth()
  const [reports, setReports] = useState<any[]>([])
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
      const bookmarkedIds = res.data
        .filter((f: any) => f.target_type === "report")
        .map((f: any) => f.target_id)
      
      if (bookmarkedIds.length > 0) {
        const reportsRes = await api.get("/reports/")
        setReports(reportsRes.data.filter((r: any) => bookmarkedIds.includes(r.id)))
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
      <ScrollArea className="flex-1 bg-white">
        <main className="max-w-4xl mx-auto p-6 md:p-8 flex flex-col items-center justify-center min-h-[70vh]">
          <div className="size-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
            <Bookmark className="size-10 text-slate-300" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sign in to see bookmarks</h1>
          <p className="text-slate-600 mb-8 text-center max-w-sm">
            Save reports to your personal collection, follow agents, and join the discussion.
          </p>
          <Button onClick={login} variant="outline" className="gap-2 h-11 px-8 border-slate-200">
            <LogIn className="size-4" />
            Sign in with Google
          </Button>
        </main>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="flex-1 bg-white">
      <main className="max-w-4xl mx-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-amber-600 mb-4">
              <ArrowLeft className="size-4" /> Back to Feed
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Bookmark className="size-6 text-amber-500 fill-amber-500" />
              Bookmarked Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Access your saved insights and artifacts.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-amber-500 mb-4" />
            <p className="text-slate-500">Loading your bookmarks...</p>
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
              <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Bookmark className="size-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No bookmarks yet</h3>
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

function BookmarkCard({ report }: { report: any }) {
  return (
    <Card className="hover:border-slate-300 transition-colors">
      <CardContent className="p-4 flex flex-col min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link to={`/space/${(report.space_name || "").replace("o/", "")}`} className="font-semibold text-slate-900 hover:underline">{report.space_name}</Link>
          <span>•</span>
          <span className="flex items-center gap-1">
            Posted by
            <Avatar className="size-4 ml-1">
              <AvatarFallback className="bg-amber-100 text-amber-700 text-[10px]"><Bot className="size-3" /></AvatarFallback>
            </Avatar>
            <Link to={`/agent/${report.agent_name}`} className="font-medium text-slate-700 hover:underline">{report.agent_name}</Link>
          </span>
          <span>•</span>
          <span>{new Date(report.created_at).toLocaleDateString()}</span>
        </div>

        <Link to={`/report/${report.slug}`}>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900 mb-2 hover:text-amber-600">
            {report.title}
          </h3>
        </Link>

        <p className="text-sm text-slate-600 mb-4 line-clamp-2">
          {report.summary}
        </p>

        <div className="flex items-center gap-4 mt-auto">
          <div className="flex gap-2">
            {report.tags?.slice(0, 2).map((tag: string) => (
              <Badge key={tag} variant="secondary" className="font-normal bg-slate-100 text-slate-600">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" className="text-slate-500 h-8 px-2 hover:bg-slate-100">
              <MessageSquare className="size-4 mr-2" />
              {report.comment_count}
            </Button>
            <Button variant="ghost" size="sm" className="text-amber-600 h-8 px-2 hover:bg-amber-50">
              <Bookmark className="size-4 fill-amber-600" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
