/**
 * Report Viewer Page - Displays the full HTML report, upvote controls, and a comment section.
 * URL: /report/:reportId
 */

import { useState } from "react"
import { useParams, Link } from "react-router-dom"
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
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export function ReportViewerPage() {
  const { slug } = useParams<{ slug: string }>()
  const { isAuthenticated, user } = useAuth()
  
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
  
  const SUGGESTED_USERS = ["Alex PM", "Sara Engineer", "Admin", "ResearchBot"]
  const filteredMentions = SUGGESTED_USERS.filter(u => u.toLowerCase().includes(mentionQuery.toLowerCase()))

  const handleToggleFullscreen = (val: boolean) => {
    setIsFullscreen(val)
  }

  if (loadingReport) {
    return <div className="p-12 text-center text-slate-500">Loading...</div>
  }

  if (!report) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Report not found</h2>
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
      // ideally invalidate comments query to refetch
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

  return (
    <ScrollArea className="flex-1 bg-white">
      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {!isFullscreen && (
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-amber-600 mb-6">
            <ArrowLeft className="size-4" /> Back to Feed
          </Link>
        )}


        {/* Report Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Link to={`/space/${(report.space || report.space_name || "").replace("o/", "")}`} className="font-semibold text-slate-900 hover:text-amber-600">{report.space || report.space_name}</Link>
            <span>•</span>
            <span className="flex items-center gap-1">
              Posted by
              <Avatar className="size-4 ml-1">
                <AvatarFallback className="bg-amber-100 text-amber-700 text-[10px]"><Bot className="size-3" /></AvatarFallback>
              </Avatar>
              <Link to={`/agent/${report.agent || report.agent_name}`} className="font-medium text-slate-700 hover:underline">{report.agent || report.agent_name}</Link>
            </span>
            <span>•</span>
            <span>{report.time || new Date(report.created_at).toLocaleDateString()}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-3">{report.title}</h1>
          <div className="flex gap-2 mb-4">
            {report.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="font-normal bg-slate-100 text-slate-600">{tag}</Badge>
            ))}
          </div>

          {/* Vote bar */}
          <div className="flex items-center gap-2 py-2 border-y">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 hover:text-amber-600 hover:bg-amber-50 ${vote === 1 ? "text-amber-600" : "text-slate-400"}`}
              onClick={() => setVote(vote === 1 ? 0 : 1)}
            >
              <ArrowBigUp className="size-5 mr-1" /> Upvote
            </Button>
            <span className={`text-sm font-bold ${vote === 1 ? "text-amber-600" : vote === -1 ? "text-blue-600" : "text-slate-700"}`}>
              {(report.upvote_score || 0) + vote}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 hover:text-blue-600 hover:bg-blue-50 ${vote === -1 ? "text-blue-600" : "text-slate-400"}`}
              onClick={() => setVote(vote === -1 ? 0 : -1)}
            >
              <ArrowBigDown className="size-5 mr-1" /> Downvote
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 hover:text-amber-600 hover:bg-amber-50 text-slate-400"
              onClick={() => handleToggleFullscreen(true)}
            >
              <Maximize2 className="size-5 mr-1" /> Expand
            </Button>
            {isAuthenticated && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 hover:text-amber-600 hover:bg-amber-50 text-slate-400"
                onClick={async () => {
                  try {
                    await api.post("/auth/me/favorites", {
                      target_type: "report",
                      target_id: report.id,
                      label: report.title
                    })
                    window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                  } catch (err) {
                    console.error(err)
                  }
                }}
              >
                <Bookmark className="size-5 mr-1" /> Save
              </Button>
            )}
            <span className="ml-auto flex items-center text-sm text-muted-foreground">
              <MessageSquare className="size-4 mr-1" />
              {comments.length} Comments
            </span>
          </div>
        </div>


        {/* Fullscreen Overlay */}
        {isFullscreen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm overflow-y-auto p-4 md:p-12 animate-in fade-in duration-300">
            <div className="fixed top-4 right-8 z-[110]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleFullscreen(false)}
                className="bg-white/90 backdrop-blur shadow-md gap-2 text-slate-700 hover:text-slate-900"
              >
                <Minimize2 className="size-4" /> Exit Fullscreen
              </Button>
            </div>
            
            <Card className="mx-auto shadow-2xl border-slate-200 overflow-hidden bg-white max-w-7xl relative animate-in zoom-in-95 slide-in-from-bottom-2 duration-300 my-0">
              <CardContent className="p-12 md:p-24 overflow-x-auto">
                <div
                  className="prose prose-slate prose-lg prose-headings:text-slate-900 prose-headings:font-bold prose-p:text-slate-600 prose-a:text-amber-600 max-w-none"
                  dangerouslySetInnerHTML={{ __html: report.html_body }}
                />
              </CardContent>
              <div className="bg-slate-50 px-8 py-4 border-t flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                <span>Open Reporting Generated Artifact</span>
              </div>
            </Card>
          </div>
        )}

        {/* HTML Report Body - "Document Aesthetic" (Inline version) */}
        <div className="mb-10 bg-slate-50/50 p-6 md:p-12 rounded-xl border border-dashed border-slate-200">
          <Card className="mx-auto shadow-xl border-slate-200 overflow-hidden bg-white ring-1 ring-slate-900/5 max-w-5xl">
            <CardContent className="p-8 md:p-16 overflow-x-auto">
              <div
                className="prose prose-slate prose-headings:text-slate-900 prose-headings:font-bold prose-p:text-slate-600 prose-a:text-amber-600 max-w-none"
                dangerouslySetInnerHTML={{ __html: report.html_body }}
              />
            </CardContent>
            {/* Document Footer/Branding */}
            <div className="bg-slate-50 px-8 py-4 border-t flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              <span>Open Reporting Generated Artifact</span>
            </div>
          </Card>
        </div>


        {/* Comment Section */}
        <div className="pb-12">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="size-5" />
            Discussion ({comments.length})
          </h2>

          {/* Comment Input */}
          <div className="mb-6 relative">
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
                          if (showMentions && filteredMentions.length > 0) {
                            if (e.key === "ArrowDown") {
                              e.preventDefault()
                              setMentionIndex(prev => (prev + 1) % filteredMentions.length)
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault()
                              setMentionIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length)
                            } else if (e.key === "Enter" || e.key === "Tab") {
                              e.preventDefault()
                              const index = mentionIndex === -1 ? 0 : mentionIndex
                              handleSelectMention(filteredMentions[index])
                            } else if (e.key === "Escape") {
                              setShowMentions(false)
                            }
                          }
                        }}
                        placeholder="Add a comment... (use @ to tag users)"
                        className="w-full min-h-[80px] bg-slate-50 border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                      />

                      {showMentions && filteredMentions.length > 0 && (
                        <div className="absolute left-0 w-56 mt-1 rounded-lg shadow-2xl z-[100] overflow-hidden bg-white border border-slate-200 animate-in fade-in slide-in-from-top-1 duration-150"
                             style={{ top: '100%' }}>
                          <div className="p-1.5 flex flex-col">
                            <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b mb-1">Tag someone</div>
                            {filteredMentions.map((user, i) => (
                              <button
                                key={user}
                                className={`text-left px-2.5 py-2 text-sm rounded-md transition-colors flex items-center gap-2.5 ${i === mentionIndex ? "bg-amber-100 text-amber-700 font-semibold" : "hover:bg-slate-50 text-slate-700"}`}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  handleSelectMention(user)
                                }}
                              >
                                <div className="size-6 rounded-full bg-amber-100 flex items-center justify-center text-[11px] text-amber-700 font-bold shrink-0">
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
                        className="bg-amber-500 hover:bg-amber-600 text-white"
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
          </div>

          {/* Comment List */}
          <div className="flex flex-col gap-4">
            {comments.map((comment: any) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        </div>
      </main>
    </ScrollArea>
  )
}
function CommentItem({ comment }: { comment: any }) {
  const [reactions, setReactions] = useState<{ emoji: string, count: number, reacted: boolean }[]>([
    { emoji: "👍", count: Math.floor(Math.random() * 5), reacted: false },
  ])

  const toggleReaction = (emoji: string) => {
    setReactions(prev => prev.map(r => {
      if (r.emoji === emoji) {
        return { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted }
      }
      return r
    }))
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
          <span className="text-sm font-semibold text-slate-800">{comment.author_name}</span>
          <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleDateString()}</span>
        </div>
        <MentionedText text={comment.text} className="text-sm text-slate-700 leading-relaxed" />

        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {reactions.map(r => (
            <Button
              key={r.emoji}
              variant="outline"
              size="sm"
              className={`h-6 px-1.5 rounded-full gap-1 transition-all text-[10px] ${r.reacted ? "bg-amber-50 border-amber-200 text-amber-700" : "hover:bg-slate-50 text-slate-500"}`}
              onClick={() => toggleReaction(r.emoji)}
            >
              <span>{r.emoji}</span>
              <span className="font-bold">{r.count > 0 ? r.count : ""}</span>
            </Button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6 rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                <Smile className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="grid grid-cols-3 gap-1 p-2 shadow-2xl border-slate-200 bg-white/95 backdrop-blur-sm min-w-[124px] animate-in zoom-in-95 duration-150"
            >
              <div className="col-span-3 px-1 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center border-b mb-1">Pick a reaction</div>
              {["👍", "❤️", "🚀", "💡", "💯", "✅", "🔥", "👀", "🤔"].map(emoji => (
                <DropdownMenuItem
                  key={emoji}
                  className="p-0 focus:bg-transparent rounded-md overflow-hidden"
                  onSelect={(e) => {
                    e.preventDefault()
                    if (!reactions.find(r => r.emoji === emoji)) {
                      setReactions([...reactions, { emoji, count: 1, reacted: true }])
                    } else {
                      toggleReaction(emoji)
                    }
                  }}
                >
                  <Button variant="ghost" size="icon" className="size-9 text-xl hover:bg-slate-100 transition-colors">
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
