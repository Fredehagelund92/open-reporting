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
  Loader2,
  Bell
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { CreateReportDialog } from "@/components/CreateReportDialog"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { type Space, type Report, type Favorite } from "@/types"

export function SpacePage() {
  const { user, isAuthenticated } = useAuth()
  const { spaceName } = useParams<{ spaceName: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const fullName = `o/${spaceName}`
  const queryClient = useQueryClient()
  const [createReportOpen, setCreateReportOpen] = useState(searchParams.get("newReport") === "1")

  const { data: spaces, isLoading: loadingSpaces } = useQuery<Space[]>({
    queryKey: ["spaces"],
    queryFn: async () => {
      const res = await api.get("/spaces/")
      return res.data.map((s: { id: string; name: string; description?: string; owner_id: string; is_private: boolean; member_count?: number }) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        owner_id: s.owner_id,
        is_private: s.is_private,
        member_count: s.member_count
      }))
    }
  })

  const space = spaces?.find((s) => s.name === fullName)

  const { data: reports, isLoading: loadingReports } = useQuery<Report[]>({
    queryKey: ["reports", fullName],
    queryFn: async () => {
      const res = await api.get(`/reports/?space=${encodeURIComponent(fullName)}`)
      const reportsWithFixedTags = res.data.map((r: { id: string; tags?: string[] | string }) => {
        let tags: string[] = []
        if (Array.isArray(r.tags)) tags = r.tags
        else if (typeof r.tags === "string") {
          try {
            tags = JSON.parse(r.tags)
          } catch (error) { // Added error variable to catch block
            console.error("Failed to parse tags:", error) // Log the error
            tags = []
          }
        }
        return { ...r, tags }
      })
      return reportsWithFixedTags
    },
    enabled: !!space
  })

  const [isFavorited, setIsFavorited] = useState(false)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("newReport") === "1") {
      setCreateReportOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (user && space?.id) {
      api.get("/auth/me/favorites").then(res => {
        setIsFavorited(res.data.some((f: Favorite) => f.targetType === "space" && f.targetId === space.id))
      }).catch(err => console.error(err))

      api.get(`/spaces/${space.id}/subscription`).then(res => {
        setIsSubscribed(res.data.subscribed)
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

  const handleToggleSubscription = async () => {
    if (!space || !user) return
    setIsSubscriptionLoading(true)
    try {
      await api.post("/auth/me/subscriptions", {
        target_type: "space",
        target_id: space.id,
        label: space.name
      })
      setIsSubscribed(!isSubscribed)
    } catch (err) {
      console.error("Failed to toggle subscription", err)
    } finally {
      setIsSubscriptionLoading(false)
    }
  }

  if (loadingSpaces || loadingReports) {
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>
  }

  if (!space) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Space not found</h2>
          <p className="text-muted-foreground mb-4">The space "{fullName}" doesn't exist.</p>
          <Link to="/">
            <Button variant="outline"><ArrowLeft className="mr-2" /> Back to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-6xl mx-auto p-6 md:p-8">

        {/* Back nav */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3.5" />
          Back to Feed
        </Link>

        {/* Space Header */}
        <div className="mb-8 rounded-xl border border-border bg-card/60 overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">

              {/* Avatar */}
              <div className="size-12 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm">
                {spaceName?.[0]?.toUpperCase()}
              </div>

              {/* Name + description + actions */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
                      {space.name}
                    </h1>
                    {space.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {space.description}
                      </p>
                    )}
                  </div>

                  {/* Action cluster */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Primary CTA */}
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

                    {/* Separator */}
                    {isAuthenticated && (
                      <div className="w-px h-5 bg-border mx-0.5" aria-hidden />
                    )}

                    {/* Settings — admin/owner only */}
                    {(user?.role === "ADMIN" || space?.owner_id === user?.id) && (
                      <Link to={`/space/${spaceName}/settings`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Space settings"
                        >
                          <Settings className="size-4" />
                        </Button>
                      </Link>
                    )}

                    {/* Favorite */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={handleToggleFavorite}
                      disabled={isFavoriteLoading}
                      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                    >
                      {isFavoriteLoading
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Star className={`size-4 transition-colors ${isFavorited ? "fill-yellow-400 text-yellow-400" : ""}`} />
                      }
                    </Button>

                    {/* Subscribe */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={handleToggleSubscription}
                      disabled={isSubscriptionLoading}
                      title={isSubscribed ? "Unsubscribe from notifications" : "Subscribe to notifications"}
                    >
                      {isSubscriptionLoading
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Bell className={`size-4 transition-colors ${isSubscribed ? "fill-foreground text-foreground" : ""}`} />
                      }
                    </Button>

                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/60 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    {reports?.length || 0} reports
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    {space.member_count || 0} members
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report List */}
        <div className="flex flex-col gap-4 pb-12">
          {reports && reports.length > 0 ? reports.map((report) => (
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

function SpaceReportCard({ report }: { report: Report }) {
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
    <Card className="flex flex-row overflow-hidden hover:border-border transition-colors py-0">
      <div className="flex flex-col items-center p-3 bg-muted/50 border-r w-14 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          disabled={!isAuthenticated || isVoting}
          className={`size-8 hover:text-primary hover:bg-primary/10 ${vote === 1 ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => handleVote(1)}
        >
          <ArrowBigUp className="size-5" />
        </Button>
        <span className={`text-sm font-bold my-1 ${vote === 1 ? "text-primary" : vote === -1 ? "text-signal" : "text-foreground"}`}>
          {score}
        </span>
        <Button
          variant="ghost"
          size="icon"
          disabled={!isAuthenticated || isVoting}
          className={`size-8 hover:text-signal hover:bg-signal/10 ${vote === -1 ? "text-signal" : "text-muted-foreground"}`}
          onClick={() => handleVote(-1)}
        >
          <ArrowBigDown className="size-5" />
        </Button>
      </div>

      <div className="px-4 py-3 flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Badge
            variant="secondary"
            className="h-5 px-2 py-0 bg-signal/15 text-signal border-signal/20 font-medium"
          >
            {report.content_type === "slideshow" ? "Presentation" : "Report"}
          </Badge>
          {report.run_number != null && (
            <Badge variant="secondary" className="h-5 px-2 py-0 font-mono text-[11px]">
              Run #{report.run_number}
            </Badge>
          )}
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
          <h3 className="text-lg font-semibold tracking-tight text-foreground mb-2 hover:text-primary">{report.title}</h3>
        </Link>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{report.summary}</p>

        <div className="flex items-center gap-4 mt-auto">
          <div className="flex gap-2">
            {report.tags.map((tag) => (
              <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary" className="font-normal bg-muted text-muted-foreground hover:bg-secondary">{tag}</Badge>
              </Link>
            ))}
          </div>
          <Link to={`/report/${report.slug}`} className="ml-auto">
            <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2 hover:bg-muted">
              <MessageSquare className="size-4 mr-2" />
              {report.comment_count} Comments
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}
