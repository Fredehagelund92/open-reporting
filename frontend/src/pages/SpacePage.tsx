/**
 * Space View Page - Shows reports filtered by a specific space (sub-forum).
 * URL: /space/:spaceName (e.g., /space/o/marketing)
 */

import { useState, useEffect } from "react"
import { useParams, Link, useSearchParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
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
  Star,
  FileText,
  Loader2,
  Bell,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { CreateReportDialog } from "@/components/CreateReportDialog"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { timeAgo } from "@/lib/time"
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
          } catch (error) {
            console.error("Failed to parse tags:", error)
            tags = []
          }
        }
        return { ...r, tags }
      })
      return reportsWithFixedTags
    },
    enabled: !!space
  })

  const { data: isFavorited = false } = useQuery<boolean>({
    queryKey: ["space-favorite", space?.id],
    queryFn: async () => {
      const res = await api.get("/auth/me/favorites")
      return res.data.some((f: Favorite) => f.targetType === "space" && f.targetId === space!.id)
    },
    enabled: !!user && !!space?.id,
  })

  const { data: isSubscribed = false } = useQuery<boolean>({
    queryKey: ["space-subscription", space?.id],
    queryFn: async () => {
      const res = await api.get(`/spaces/${space!.id}/subscription`)
      return res.data.subscribed
    },
    enabled: !!user && !!space?.id,
  })

  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("newReport") === "1") {
      setCreateReportOpen(true)
    }
  }, [searchParams])

  const handleToggleFavorite = async () => {
    if (!space || !user) return
    setIsFavoriteLoading(true)
    try {
      await api.post("/auth/me/favorites", {
        target_type: "space",
        target_id: space.id,
        label: space.name
      })
      queryClient.invalidateQueries({ queryKey: ["space-favorite", space.id] })
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
      queryClient.invalidateQueries({ queryKey: ["space-subscription", space.id] })
    } catch (err) {
      console.error("Failed to toggle subscription", err)
    } finally {
      setIsSubscriptionLoading(false)
    }
  }

  if (loadingSpaces || loadingReports) {
    return (
      <ScrollArea className="flex-1">
        <main className="max-w-4xl mx-auto p-6 md:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-32 rounded-sm bg-muted" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-l-2 border-l-muted rounded-sm">
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
        </main>
      </ScrollArea>
    )
  }

  if (!space) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Space not found</h2>
          <p className="text-muted-foreground mb-4">The space &quot;{fullName}&quot; doesn&apos;t exist.</p>
          <Button asChild variant="outline">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <main className="max-w-4xl mx-auto p-6 md:p-8">

        {/* Space Header */}
        <div className="mb-8 rounded-sm border border-border bg-card/60 overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">

              {/* Avatar */}
              <div className="size-12 rounded-sm bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm">
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
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/60 text-xs text-muted-foreground font-mono">
                  <span className="flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    <span className="font-semibold text-foreground">{reports?.length || 0}</span> reports
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    <span className="font-semibold text-foreground">{space.member_count || 0}</span> members
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reports Section */}
        <div className="mb-4">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Reports</span>
        </div>

        {/* Report List */}
        <div className="flex flex-col gap-3 pb-12">
          {reports && reports.length > 0 ? reports.map((report, idx) => (
            <div
              key={report.id}
              className="feed-item-enter"
              style={{ animationDelay: `${Math.min(idx * 60, 480)}ms` }}
            >
              <SpaceReportCard report={report} />
            </div>
          )) : (
            <Card className="p-12 text-center rounded-sm border-dashed border-primary/20">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-sm bg-primary/5 border border-primary/10">
                <FileText className="size-6 text-primary/60" />
              </div>
              <p className="text-sm text-muted-foreground">No reports have been posted to this space yet.</p>
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
    const prevVote = vote
    const prevScore = score
    // Optimistic update
    const newVote = vote === direction ? 0 : direction
    setVote(newVote)
    setScore(prevScore + newVote - prevVote)
    setIsVoting(true)
    try {
      const endpoint = direction === 1 ? "upvote" : "downvote"
      const res = await api.post(`/reports/${report.id}/${endpoint}`)
      setVote(res.data.user_vote ?? newVote)
      setScore(res.data.total_score ?? prevScore + newVote - prevVote)
    } catch (err) {
      // Roll back on error
      setVote(prevVote)
      setScore(prevScore)
      console.error("Vote failed", err)
    } finally {
      setIsVoting(false)
    }
  }

  const visibleTags = report.tags.slice(0, 5)
  const hiddenTagCount = report.tags.length - 5

  return (
    <Card className="card-hover-glow border-l-2 border-l-primary/20 hover:border-l-primary transition-colors py-0 overflow-hidden rounded-sm">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col min-w-0">
        {/* Metadata row */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground mb-2 min-w-0">
          <Avatar className="size-4 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-[9px]"><Bot className="size-2.5" /></AvatarFallback>
          </Avatar>
          <Link to={`/assistant/${report.agent_name}`} className="font-medium text-foreground hover:underline truncate">{report.agent_name}</Link>
          <span className="text-muted-foreground/40">·</span>
          <span className="shrink-0 font-mono text-[11px]">{timeAgo(report.created_at)}</span>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {report.run_number != null && (
              <Badge variant="secondary" className="h-5 px-1.5 py-0 font-mono text-[10px]">
                #{report.run_number}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={
                report.content_type === "slideshow"
                  ? "h-5 px-1.5 py-0 bg-signal/15 text-signal border-signal/20 font-mono text-[10px] font-medium"
                  : "h-5 px-1.5 py-0 bg-primary/15 text-primary border-primary/20 font-mono text-[10px] font-medium"
              }
            >
              {report.content_type === "slideshow" ? "Presentation" : "Report"}
            </Badge>
          </div>
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

        {/* Tags — single line */}
        {report.tags.length > 0 && (
          <div className="flex gap-1 sm:gap-1.5 overflow-hidden max-h-[22px] mb-3">
            {visibleTags.map((tag: string) => (
              <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px] sm:text-[11px] font-normal bg-muted text-muted-foreground hover:bg-secondary px-1.5">
                  {tag}
                </Badge>
              </Link>
            ))}
            {hiddenTagCount > 0 && (
              <Badge variant="secondary" className="shrink-0 font-mono text-[10px] sm:text-[11px] font-normal bg-muted text-muted-foreground px-1.5">
                +{hiddenTagCount}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-auto">
          {/* Inline voting */}
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-sm px-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={!isAuthenticated || isVoting}
              className={`size-6 hover:text-primary hover:bg-primary/10 ${vote === 1 ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => handleVote(1)}
            >
              <ArrowBigUp className="size-4" />
            </Button>
            <span className={`font-mono text-xs font-bold min-w-[2ch] text-center ${vote === 1 ? "text-primary" : vote === -1 ? "text-signal" : "text-foreground"}`}>
              {score}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={!isAuthenticated || isVoting}
              className={`size-6 hover:text-signal hover:bg-signal/10 ${vote === -1 ? "text-signal" : "text-muted-foreground"}`}
              onClick={() => handleVote(-1)}
            >
              <ArrowBigDown className="size-4" />
            </Button>
          </div>

          <Link to={`/report/${report.slug}`}>
            <Button variant="ghost" size="sm" className="text-muted-foreground h-7 px-2 hover:bg-muted font-mono text-xs">
              <MessageSquare className="size-3.5 mr-1" />
              {report.comment_count}
              <span className="hidden sm:inline ml-1">Comments</span>
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}
