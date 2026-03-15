/**
 * Report Viewer Page - Displays the full HTML report, upvote controls, and a comment section.
 * URL: /report/:reportId
 */

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarColor, getInitials } from "@/lib/user"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MentionedText } from "@/components/MentionedText"
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Bot,
  ArrowLeft,
  Send,
  Bookmark,
  Maximize2,
  Minimize2,
  Smile,
  Trash2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import DOMPurify from "dompurify"
import { SlideshowViewer } from "@/components/SlideshowViewer"

export function ReportViewerPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const queryClient = useQueryClient()

  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ["report", slug],
    queryFn: async () => {
      const res = await api.get(`/reports/${slug}`)
      return res.data
    },
    enabled: !!slug
  })

  // Comments would eventually come from an API, but keeping local state for now or fetching 
  // if endpoint exists. (Assuming /reports/{id}/comments)
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", report?.id],
    queryFn: async () => {
      const res = await api.get(`/reports/${report?.id}/comments`)
      return res.data
    },
    enabled: !!report?.id
  })

  const [vote, setVote] = useState(0)
  const [commentText, setCommentText] = useState("")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(-1)
  const [isVoting, setIsVoting] = useState(false)
  const [currentScore, setCurrentScore] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!report) return
    setVote(report.user_vote ?? 0)
    setCurrentScore(report.upvote_score ?? 0)
  }, [report?.id, report?.user_vote, report?.upvote_score])

  const SUGGESTED_USERS = ["Alex PM", "Sara Engineer", "Admin", "ResearchBot"]
  const filteredMentions = SUGGESTED_USERS.filter(u => u.toLowerCase().includes(mentionQuery.toLowerCase()))

  const handleToggleFullscreen = (val: boolean) => {
    setIsFullscreen(val)
  }

  const handleVote = async (direction: 1 | -1) => {
    if (!isAuthenticated || !report || isVoting) return
    setIsVoting(true)
    try {
      const endpoint = direction === 1 ? "upvote" : "downvote"
      const res = await api.post(`/reports/${report.id}/${endpoint}`)
      setVote(res.data.user_vote ?? 0)
      setCurrentScore(res.data.total_score ?? currentScore ?? report.upvote_score ?? 0)
    } catch (err) {
      console.error("Vote failed", err)
    } finally {
      setIsVoting(false)
    }
  }

  if (loadingReport) {
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>
  }

  if (!report) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Report not found</h2>
          <p className="text-muted-foreground mb-4">This report doesn't exist or has been removed.</p>
          <Link to="/">
            <Button variant="outline"><ArrowLeft className="mr-2" /> Back to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !report) return
    try {
      await api.post(`/reports/${report.id}/comments`, { text: commentText.trim() })
      setCommentText("")
      await queryClient.invalidateQueries({ queryKey: ["comments", report.id] })
      await queryClient.invalidateQueries({ queryKey: ["report", slug] })
    } catch (err) {
      console.error(err)
    }
  }

  const handleSelectMention = (userName: string) => {
    const words = commentText.split(/\s/)
    words[words.length - 1] = `@${userName.replace(/\s+/g, "")}`
    setCommentText(words.join(" ") + " ")
    setShowMentions(false)
    setMentionIndex(-1)
  }
  const publishedAt = new Date(report.created_at)
  const publishedLabel = publishedAt.toLocaleString()

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {!isFullscreen && (
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
            <ArrowLeft className="size-4" /> Back to Feed
          </Link>
        )}


        {/* Report Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Link to={`/space/${(report.space || report.space_name || "").replace("o/", "")}`} className="font-semibold text-foreground hover:text-primary">{report.space || report.space_name}</Link>
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
              <Link to={`/assistant/${report.agent || report.agent_name}`} className="font-medium text-foreground hover:underline">{report.agent || report.agent_name}</Link>
            </span>
            <span>•</span>
            <span>{report.time || new Date(report.created_at).toLocaleDateString()}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-3">{report.title}</h1>
          <div className="flex gap-2 mb-4">
            {report.tags.map((tag: string) => (
              <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary" className="font-normal bg-muted text-muted-foreground">{tag}</Badge>
              </Link>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3 mb-4 rounded-lg border border-border bg-muted p-3 text-xs">
            <div>
              <p className="text-muted-foreground uppercase tracking-wide">Generated</p>
              <p className="font-medium text-foreground">{publishedLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase tracking-wide">Artifact Type</p>
              <p className="font-medium text-foreground">{report.content_type === "slideshow" ? "Presentation" : "Report"}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase tracking-wide">Trust Signal</p>
              <p className="font-medium text-foreground">Sanitized HTML rendering enabled</p>
            </div>
          </div>

          {/* Vote bar */}
          <div className="flex items-center gap-2 py-2 border-y">
            <Button
              variant="ghost"
              size="sm"
              disabled={!isAuthenticated || isVoting}
              className={`h-8 hover:text-primary hover:bg-primary/10 ${vote === 1 ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => handleVote(1)}
            >
              <ArrowBigUp className="size-5 mr-1" /> Upvote
            </Button>
            <span className={`text-sm font-bold ${vote === 1 ? "text-primary" : vote === -1 ? "text-signal" : "text-foreground"}`}>
              {currentScore ?? report.upvote_score ?? 0}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!isAuthenticated || isVoting}
              className={`h-8 hover:text-signal hover:bg-signal/10 ${vote === -1 ? "text-signal" : "text-muted-foreground"}`}
              onClick={() => handleVote(-1)}
            >
              <ArrowBigDown className="size-5 mr-1" /> Downvote
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 hover:text-primary hover:bg-primary/10 text-muted-foreground"
              onClick={() => handleToggleFullscreen(true)}
            >
              <Maximize2 className="size-5 mr-1" /> Expand
            </Button>
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isSaving}
                className="h-8 hover:text-primary hover:bg-primary/10 text-muted-foreground active:scale-95 transition-transform"
                onClick={async () => {
                  setIsSaving(true)
                  setSaveMessage("")
                  try {
                    await api.post("/auth/me/favorites", {
                      target_type: "report",
                      target_id: report.id,
                      label: report.title
                    })
                    window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                    setSaveMessage("Saved to bookmarks")
                  } catch (err) {
                    console.error("Save failed", err)
                    setSaveMessage("Could not save report")
                  } finally {
                    setIsSaving(false)
                  }
                }}
              >
                <Bookmark className="size-5 mr-1" /> Save
              </Button>
            )}
            {isAuthenticated && report.can_delete && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                className="h-8 hover:text-destructive hover:bg-destructive/10 text-muted-foreground"
                onClick={async () => {
                  if (!confirm("Delete this report permanently? This action cannot be undone.")) return
                  setIsDeleting(true)
                  try {
                    await api.delete(`/reports/${report.id}`)
                    await queryClient.invalidateQueries({ queryKey: ["reports"] })
                    await queryClient.invalidateQueries({ queryKey: ["spaces"] })
                    window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                    navigate(report.space_name ? `/space/${report.space_name.replace("o/", "")}` : "/")
                  } catch (err) {
                    console.error("Delete failed", err)
                  } finally {
                    setIsDeleting(false)
                  }
                }}
              >
                <Trash2 className="size-5 mr-1" /> Delete
              </Button>
            )}
            {saveMessage && <span className="text-xs text-muted-foreground">{saveMessage}</span>}
            <span className="ml-auto flex items-center text-sm text-muted-foreground">
              <MessageSquare className="size-4 mr-1" />
              {comments.length} Comments
            </span>
          </div>
        </div>


        {/* Fullscreen Overlay */}
        {isFullscreen && (
          report.content_type === "slideshow" ? (
            <div className="fixed inset-0 z-[100] bg-foreground/90 backdrop-blur-sm overflow-hidden animate-in fade-in duration-300">
              <div className="fixed top-4 right-4 z-[110]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleFullscreen(false)}
                  className="bg-card/90 backdrop-blur shadow-md gap-2 text-foreground hover:text-foreground"
                >
                  <Minimize2 className="size-4" /> Exit Fullscreen
                </Button>
              </div>

              <SlideshowViewer
                htmlBody={report.html_body}
                isFullscreen={true}
                onRequestExitFullscreen={() => handleToggleFullscreen(false)}
              />
            </div>
          ) : (
            <div className="fixed inset-0 z-[100] bg-foreground/90 backdrop-blur-sm overflow-y-auto p-4 md:p-12 animate-in fade-in duration-300">
              <div className="fixed top-4 right-8 z-[110]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleFullscreen(false)}
                  className="bg-card/90 backdrop-blur shadow-md gap-2 text-foreground hover:text-foreground"
                >
                  <Minimize2 className="size-4" /> Exit Fullscreen
                </Button>
              </div>

              <Card className="mx-auto shadow-2xl border-border overflow-hidden bg-card max-w-7xl relative animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 my-0">
                <CardContent className="p-12 md:p-24 overflow-x-auto">
                  <div
                    className="prose prose-slate prose-lg prose-headings:text-foreground prose-headings:font-bold prose-p:text-muted-foreground prose-a:text-primary max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(report.html_body, {
                        ADD_TAGS: ["canvas"],
                        ADD_ATTR: ["style"],
                      }),
                    }}
                  />
                </CardContent>
                <div className="bg-muted px-8 py-4 border-t flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                  <span></span>
                </div>
              </Card>
            </div>
          )
        )}

        {/* HTML Report Body - "Document Aesthetic" (Inline version) */}
        <div className="mb-10 bg-muted/50 p-6 md:p-12 rounded-xl border border-dashed border-border">
          <Card className="mx-auto shadow-xl border-border overflow-hidden bg-card ring-1 ring-slate-900/5 max-w-5xl">
            <CardContent className={report.content_type === "slideshow" ? "p-2 md:p-3 bg-transparent" : "p-8 md:p-16 overflow-x-auto"}>
              {report.content_type === "slideshow" ? (
                <SlideshowViewer htmlBody={report.html_body} />
              ) : (
                <div
                  className="prose prose-slate prose-headings:text-foreground prose-headings:font-bold prose-p:text-muted-foreground prose-a:text-primary max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.html_body, { ADD_TAGS: ['canvas'], ADD_ATTR: ['style'] }) }}
                />
              )}
            </CardContent>
            {/* Document Footer/Branding */}
            <div className="bg-muted px-8 py-4 border-t flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              <span></span>
            </div>
          </Card>
        </div>


        {/* Comment Section */}
        <div className="pb-12">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageSquare className="size-5" />
            Discussion ({comments.length})
          </h2>

          {/* Comment Input */}
          <div className="mb-6 relative">
            {isAuthenticated ? (
              <Card className="overflow-visible">
                <CardContent className="p-4 overflow-visible">
                  <div className="flex gap-3">
                    <Avatar className="size-8 shrink-0">
                      {user?.avatar && <AvatarImage src={user.avatar} alt={user?.name || "CurrentUser"} className="object-cover" />}
                      <AvatarFallback className={`text-xs ${getAvatarColor(user?.name || user?.id)}`}>
                        {user?.name ? getInitials(user.name) : <Bot className="size-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="relative">
                        <textarea
                          value={commentText}
                          onChange={(e) => {
                            const val = e.target.value
                            setCommentText(val)

                            const words = val.split(/\s/)
                            const lastWord = words[words.length - 1]

                            if (lastWord.startsWith("@")) {
                              setMentionQuery(lastWord.slice(1))
                              setShowMentions(true)
                            } else {
                              setShowMentions(false)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              if (showMentions && filteredMentions.length > 0) {
                                e.preventDefault()
                                const index = mentionIndex === -1 ? 0 : mentionIndex
                                handleSelectMention(filteredMentions[index])
                              } else {
                                e.preventDefault()
                                handleSubmitComment()
                              }
                              return
                            }

                            if (showMentions && filteredMentions.length > 0) {
                              if (e.key === "ArrowDown") {
                                e.preventDefault()
                                setMentionIndex(prev => (prev + 1) % filteredMentions.length)
                              } else if (e.key === "ArrowUp") {
                                e.preventDefault()
                                setMentionIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length)
                              } else if (e.key === "Tab") {
                                e.preventDefault()
                                const index = mentionIndex === -1 ? 0 : mentionIndex
                                handleSelectMention(filteredMentions[index])
                              } else if (e.key === "Escape") {
                                setShowMentions(false)
                              }
                            }
                          }}
                          placeholder="Add a comment... (use @ to tag users)"
                          className="w-full min-h-[80px] bg-muted border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />

                        {showMentions && filteredMentions.length > 0 && (
                          <div className="absolute left-0 w-56 mt-1 rounded-lg shadow-2xl z-[100] overflow-hidden bg-card border border-border animate-in fade-in slide-in-from-top-1 duration-150"
                            style={{ top: '100%' }}>
                            <div className="p-1.5 flex flex-col">
                              <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b mb-1">Tag someone</div>
                              {filteredMentions.map((user, i) => (
                                <button
                                  key={user}
                                  className={`text-left px-2.5 py-2 text-sm rounded-md transition-colors flex items-center gap-2.5 ${i === mentionIndex ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-foreground"}`}
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    handleSelectMention(user)
                                  }}
                                >
                                  <div className="size-6 rounded-full bg-primary/15 flex items-center justify-center text-[11px] text-primary font-bold shrink-0">
                                    {user.split(" ").map(n => n[0]).join("")}
                                  </div>
                                  <span>{user}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end mt-2">
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-white"
                          onClick={handleSubmitComment}
                          disabled={!commentText.trim()}
                        >
                          <Send className="size-4 mr-1" /> Comment
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Sign in to comment and vote on reports.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Comment List */}
          <div className="flex flex-col gap-4">
            {comments.map((comment: any) => (
              <CommentItem key={comment.id} comment={comment} reportId={report.id} />
            ))}
          </div>
        </div>
      </main>
    </ScrollArea>
  )
}
function CommentItem({ comment, reportId }: { comment: any; reportId: string }) {
  const { isAuthenticated } = useAuth()
  const [reactions, setReactions] = useState<{ emoji: string; count: number; reacted: boolean }[]>(
    Array.isArray(comment.reactions) ? comment.reactions : [],
  )
  const [isReacting, setIsReacting] = useState<string | null>(null)

  useEffect(() => {
    setReactions(Array.isArray(comment.reactions) ? comment.reactions : [])
  }, [comment.id, comment.reactions])

  const toggleReaction = async (emoji: string) => {
    if (!isAuthenticated || isReacting) return
    setIsReacting(emoji)
    setReactions((prev) => {
      const existing = prev.find((r) => r.emoji === emoji)
      if (existing) {
        return prev.map((r) =>
          r.emoji === emoji
            ? { ...r, reacted: !r.reacted, count: r.reacted ? Math.max(0, r.count - 1) : r.count + 1 }
            : r,
        )
      }
      return [...prev, { emoji, count: 1, reacted: true }]
    })
    try {
      await api.post(`/reports/${reportId}/comments/${comment.id}/reactions`, { emoji })
    } catch (err) {
      console.error("Reaction update failed", err)
      setReactions(Array.isArray(comment.reactions) ? comment.reactions : [])
    } finally {
      setIsReacting(null)
    }
  }

  return (
    <div className="flex gap-3 group">
      <Avatar className="size-8 shrink-0 mt-0.5">
        {comment.author_avatar && <AvatarImage src={comment.author_avatar} alt={comment.author_name} className="object-cover" />}
        <AvatarFallback className={`text-xs ${getAvatarColor(comment.author_name || comment.author?.name || comment.id)}`}>
          {getInitials(comment.author_name || comment.author?.name || "Unknown")}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-foreground">{comment.author_name}</span>
          <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleDateString()}</span>
        </div>
        <MentionedText text={comment.text} className="text-sm text-foreground leading-relaxed" />

        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {reactions.map(r => (
            <Button
              key={r.emoji}
              variant="outline"
              size="sm"
              disabled={!isAuthenticated || !!isReacting}
              className={`h-6 px-1.5 rounded-full gap-1 transition-all text-[10px] ${r.reacted ? "bg-primary/10 border-primary/20 text-primary" : "hover:bg-muted text-muted-foreground"}`}
              onClick={() => void toggleReaction(r.emoji)}
            >
              <span>{r.emoji}</span>
              <span className="font-bold">{r.count > 0 ? r.count : ""}</span>
            </Button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!isAuthenticated || !!isReacting}
                className="size-6 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <Smile className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="grid grid-cols-3 gap-1 p-2 shadow-2xl border-border bg-card/95 backdrop-blur-sm min-w-[124px] animate-in zoom-in-95 duration-150"
            >
              <div className="col-span-3 px-1 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center border-b mb-1">Pick a reaction</div>
              {["👍", "❤️", "🚀", "💡", "💯", "✅", "🔥", "👀", "🤔"].map(emoji => (
                <DropdownMenuItem
                  key={emoji}
                  className="p-0 focus:bg-transparent rounded-md overflow-hidden"
                  onSelect={(e) => {
                    e.preventDefault()
                    void toggleReaction(emoji)
                  }}
                >
                  <Button variant="ghost" size="icon" className="size-9 text-xl hover:bg-muted transition-colors">
                    {emoji}
                  </Button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
