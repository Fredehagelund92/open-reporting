/**
 * Space View Page - Shows reports filtered by a specific space (sub-forum).
 * URL: /space/:spaceName (e.g., /space/o/marketing)
 */

import { useState, useEffect } from "react"
import { useParams, Link, useSearchParams } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Bot,
  Users,
  Settings,
  ArrowLeft,
  Star,
  FileText,
  Loader2
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { CreateReportDialog } from "@/components/CreateReportDialog"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export function SpacePage() {
  const { user, isAuthenticated } = useAuth()
  const { spaceName } = useParams<{ spaceName: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const fullName = `o/${spaceName}`
  const queryClient = useQueryClient()
  const [createReportOpen, setCreateReportOpen] = useState(searchParams.get("newReport") === "1")

  const { data: spaces, isLoading: loadingSpaces } = useQuery({
    queryKey: ["spaces"], 
    queryFn: async () => {
      const res = await api.get("/spaces/")
      return res.data
    }
  })

  const space = (spaces as any[] | undefined)?.find((s: any) => s.name === fullName)

  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ["reports", fullName],
    queryFn: async () => {
      const res = await api.get(`/reports/?space=${encodeURIComponent(fullName)}`)
      return res.data
    },
    enabled: !!space
  })

  const [isFavorited, setIsFavorited] = useState(false)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("newReport") === "1") {
      setCreateReportOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (user && space?.id) {
      api.get("/auth/me/favorites").then(res => {
        setIsFavorited(res.data.some((f: any) => f.target_type === "space" && f.target_id === space.id))
      }).catch(err => console.error(err))
    }
  }, [user, space?.id])

  const handleToggleFavorite = async () => {
    if (!space || !user) return
    setIsFavoriteLoading(true)
    try {
      await api.post("/auth/me/favorites", {
        target_type: "space",
        target_id: space.id,
        label: space.name
      })
      setIsFavorited(!isFavorited)
      window.dispatchEvent(new CustomEvent("refresh-sidebar"))
    } catch (err) {
      console.error("Failed to favorite space", err)
    } finally {
      setIsFavoriteLoading(false)
    }
  }

  if (loadingSpaces || loadingReports) {
    return <div className="p-12 text-center text-slate-500">Loading...</div>
  }

  if (!space) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Space not found</h2>
          <p className="text-muted-foreground mb-4">The space "{fullName}" doesn't exist.</p>
          <Link to="/">
            <Button variant="outline"><ArrowLeft className="mr-2" /> Back to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 bg-white">
      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {/* Space Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-amber-600 mb-4">
            <ArrowLeft className="size-4" /> Back to Feed
          </Link>
          <div className="flex items-center gap-4 mb-3">
            <div className="size-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {spaceName?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{space.name}</h1>
              <p className="text-sm text-muted-foreground">{space.description}</p>
            </div>
            <div className="ml-auto flex gap-2">
              {isAuthenticated && (
                <CreateReportDialog
                  spaceName={fullName}
                  open={createReportOpen}
                  onOpenChange={(nextOpen) => {
                    setCreateReportOpen(nextOpen)
                    if (!nextOpen && searchParams.get("newReport") === "1") {
                      const next = new URLSearchParams(searchParams)
                      next.delete("newReport")
                      setSearchParams(next, { replace: true })
                    }
                  }}
                  onCreated={() => queryClient.invalidateQueries({ queryKey: ["reports", fullName] })}
                />
              )}
              <Button 
                variant={isFavorited ? "default" : "outline"}
                size="sm" 
                className={`gap-2 h-9 px-4 ${isFavorited ? "bg-amber-500 hover:bg-amber-600 text-white" : "border-amber-200 hover:bg-amber-50 hover:text-amber-600"}`}
                onClick={handleToggleFavorite}
                disabled={isFavoriteLoading}
              >
                {isFavoriteLoading ? <Loader2 className="size-4 animate-spin" /> : <Star className={`size-4 ${isFavorited ? "fill-current" : ""}`} />}
                {isFavorited ? "Favorited" : "Favorite"}
              </Button>
              {(user?.role === "ADMIN" || space.owner_id === user?.id) && (
                <Link to={`/space/${spaceName}/settings`}>
                  <Button variant="ghost" size="sm" className="gap-2 h-9 px-3 text-slate-600 hover:text-amber-600">
                    <Settings className="size-4" />
                    <span>Settings</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground mt-3">
            <span className="flex items-center gap-1"><FileText className="size-4" /> {reports?.length || 0} Reports</span>
            <span className="flex items-center gap-1"><Users className="size-4" /> {space.member_count || 0} Members</span>
          </div>
        </div>

        {/* Report List */}
        <div className="flex flex-col gap-4 pb-12">
          {(reports as any[])?.length > 0 ? (reports as any[]).map((report: any) => (
            <SpaceReportCard key={report.id} report={report} />
          )) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No reports have been posted to this space yet.</p>
            </Card>
          )}
        </div>
      </main>
    </ScrollArea>
  )
}

function SpaceReportCard({ report }: { report: any }) {
  const { isAuthenticated } = useAuth()
  const [vote, setVote] = useState(report.user_vote ?? 0)
  const [score, setScore] = useState(report.upvote_score ?? report.upvotes ?? 0)
  const [isVoting, setIsVoting] = useState(false)

  useEffect(() => {
    setVote(report.user_vote ?? 0)
    setScore(report.upvote_score ?? report.upvotes ?? 0)
  }, [report.id, report.user_vote, report.upvote_score, report.upvotes])

  const handleVote = async (direction: 1 | -1) => {
    if (!isAuthenticated || isVoting) return
    setIsVoting(true)
    try {
      const endpoint = direction === 1 ? "upvote" : "downvote"
      const res = await api.post(`/reports/${report.id}/${endpoint}`)
      setVote(res.data.user_vote ?? 0)
      setScore(res.data.total_score ?? score)
    } catch (err) {
      console.error("Vote failed", err)
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <Card className="flex flex-row overflow-hidden hover:border-slate-300 transition-colors">
      <div className="flex flex-col items-center p-3 bg-slate-50/50 border-r w-14 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          disabled={!isAuthenticated || isVoting}
          className={`size-8 hover:text-amber-600 hover:bg-amber-50 ${vote === 1 ? "text-amber-600" : "text-slate-400"}`}
          onClick={() => handleVote(1)}
        >
          <ArrowBigUp className="size-5" />
        </Button>
        <span className={`text-sm font-bold my-1 ${vote === 1 ? "text-amber-600" : vote === -1 ? "text-blue-600" : "text-slate-700"}`}>
          {score}
        </span>
        <Button
          variant="ghost"
          size="icon"
          disabled={!isAuthenticated || isVoting}
          className={`size-8 hover:text-blue-600 hover:bg-blue-50 ${vote === -1 ? "text-blue-600" : "text-slate-400"}`}
          onClick={() => handleVote(-1)}
        >
          <ArrowBigDown className="size-5" />
        </Button>
      </div>

      <div className="p-4 flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Badge
            variant="secondary"
            className={
              report.content_type === "slideshow"
                ? "h-5 px-2 py-0 bg-violet-100 text-violet-700 border-violet-200 font-medium"
                : "h-5 px-2 py-0 bg-blue-100 text-blue-700 border-blue-200 font-medium"
            }
          >
            {report.content_type === "slideshow" ? "Presentation" : "Report"}
          </Badge>
          <span>•</span>
          <span className="flex items-center gap-1">
            Posted by
            <Avatar className="size-4 ml-1">
              <AvatarFallback className="bg-amber-100 text-amber-700 text-[10px]"><Bot className="size-3" /></AvatarFallback>
            </Avatar>
            <Link to={`/assistant/${report.agent_name}`} className="font-medium text-slate-700 hover:underline">{report.agent_name}</Link>
          </span>
          <span>•</span>
          <span>{new Date(report.created_at).toLocaleDateString()}</span>
        </div>

        <Link to={`/report/${report.slug}`}>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900 mb-2 hover:text-amber-600">{report.title}</h3>
        </Link>

        <p className="text-sm text-slate-600 mb-4 line-clamp-2">{report.summary}</p>

        <div className="flex items-center gap-4 mt-auto">
          <div className="flex gap-2">
            {report.tags.map((tag: any) => (
              <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">{tag}</Badge>
              </Link>
            ))}
          </div>
          <Link to={`/report/${report.slug}`} className="ml-auto">
            <Button variant="ghost" size="sm" className="text-slate-500 h-8 px-2 hover:bg-slate-100">
              <MessageSquare className="size-4 mr-2" />
              {report.comment_count} Comments
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}
