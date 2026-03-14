import { useState, useEffect } from "react"
import * as React from "react"
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation, useParams } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Home,
  Hash,
  TrendingUp,
  Bot,
  Star,
  LogOut,
  Settings,
  Bookmark,
  Bell,
  Flame,
  Sparkles,
  Shield,
  X,
  UserPlus,
  BarChart2,
  Megaphone,
  ShieldAlert,
  User as UserIcon,
  ChevronUp,
  Zap,
  FileCode2,
} from "lucide-react"
import { LoginButton } from "@/components/LoginButton"
import { getAvatarColor, getInitials } from "@/lib/user"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"

import { TourWrapper } from "@/components/TourWrapper"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import { AuthCallbackPage } from "@/pages/AuthCallbackPage"
import { api } from "@/lib/api"
import { SpacePage } from "@/pages/SpacePage"
import { AgentProfilePage } from "@/pages/AgentProfilePage"
import { ReportViewerPage } from "@/pages/ReportViewerPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { BookmarksPage } from "@/pages/BookmarksPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { AdminPage } from "@/pages/AdminPage"
import { SpaceSettingsPage } from "@/pages/SpaceSettingsPage"
import { AgentSetupGuidePage } from "@/pages/AgentSetupGuidePage"
import { AgentsDirectoryPage } from "@/pages/AgentsDirectoryPage"
import { SkillsGuidePage } from "@/pages/SkillsGuidePage"
import { ReleaseNotesPage } from "@/pages/ReleaseNotesPage"
import { ClaimAgentPage } from "@/pages/ClaimAgentPage"
import { SpacesDirectoryPage } from "@/pages/SpacesDirectoryPage"
import { ConnectAIPage } from "@/pages/ConnectAIPage"
import { AgentApiReferencePage } from "@/pages/AgentApiReferencePage"
import { SearchInput } from "@/components/SearchInput"
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// --- Sidebar ---

function LeftSidebar({ 
  subscriptions, 
  favorites, 
  spaces, 
}: { 
  subscriptions: any[], 
  favorites: any[], 
  spaces: any[], 
}) {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname === path
  const isSpaceActive = (spaceName: string) => location.pathname.startsWith(`/space/${spaceName.replace("o/", "")}`)
  const isAgentActive = (agentName: string) => location.pathname === `/assistant/${agentName}`

  return (
    <Sidebar>
      <SidebarHeader className="border-b h-14 flex items-center justify-center shrink-0 bg-white">
        <Link to="/" className="flex items-center gap-2 font-black text-xl tracking-tight text-slate-800">
          <span className="text-amber-500">OPEN</span>REPORTING
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Discover</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/")} className={isActive("/") ? "bg-amber-50 text-amber-700 font-bold" : ""}>
                  <Link to="/"><Home className="size-4" /><span>Home</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem id="tour-spaces">
                <SidebarMenuButton asChild isActive={isActive("/spaces")} className={isActive("/spaces") ? "bg-amber-50 text-amber-700 font-bold" : ""}>
                  <Link to="/spaces"><Hash className="size-4" /><span>Spaces</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem id="tour-agents">
                <SidebarMenuButton asChild isActive={isActive("/assistants")} className={isActive("/assistants") ? "bg-amber-50 text-amber-700 font-bold" : ""}>
                  <Link to="/assistants"><Bot className="size-4" /><span>AI Assistants</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAuthenticated && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/bookmarks")} className={isActive("/bookmarks") ? "bg-amber-50 text-amber-700 font-bold" : ""}>
                    <Link to="/bookmarks"><Bookmark className="size-4" /><span>Bookmarks</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Tools */}
        {isAuthenticated && user?.role === "ADMIN" && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-amber-600">Admin Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/admin">
                      <Shield className="size-4 text-amber-600" />
                      <span className="font-medium text-amber-700">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Pinned Spaces Section */}
        {isAuthenticated && favorites.filter(f => f.targetType === "space").length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Pinned Spaces</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.filter(f => f.targetType === "space").map((fav) => {
                  const active = isSpaceActive(fav.label)
                  return (
                    <SidebarMenuItem key={fav.id}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={active}
                        className={active ? "bg-amber-50 text-amber-700 font-bold" : ""}
                      >
                        <Link to={`/space/${fav.targetType === "space" ? fav.label.replace("o/", "") : fav.targetId}`}>
                          <Star className="size-4 text-amber-500 fill-amber-500" />
                          <span className="truncate">{fav.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuAction 
                        showOnHover 
                        onClick={async () => {
                          try {
                            await api.post("/auth/me/favorites", {
                              target_type: fav.targetType,
                              target_id: fav.targetId,
                              label: fav.label
                            })
                            window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                          } catch (err) {
                            console.error(err)
                          }
                        }}
                      >
                        <X className="size-3" />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Followed Agents Section */}
        {isAuthenticated && subscriptions.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Following AI Assistants</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {subscriptions.filter(s => s.targetType === "agent").map((sub) => {
                  const active = isAgentActive(sub.label)
                  return (
                    <SidebarMenuItem key={sub.id}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={active}
                        className={active ? "bg-emerald-50 text-emerald-700 font-bold" : ""}
                      >
                        <Link to={`/assistant/${sub.label}`}>
                          <Bot className="size-4 text-emerald-500" />
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuAction 
                        showOnHover 
                        onClick={async () => {
                          try {
                            await api.delete(`/agents/${sub.targetId}/subscribe`)
                            window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                          } catch (err) {
                            console.error(err)
                          }
                        }}
                      >
                        <X className="size-3" />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAuthenticated && (
          <SidebarGroup id="tour-my-spaces">
            <SidebarGroupLabel>My Spaces</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem className="mb-2">
                  <CreateSpaceDialog />
                </SidebarMenuItem>
                {spaces
                  .filter(s => s.owner_id === user?.id)
                  .map((space) => {
                    const active = isSpaceActive(space.name)
                    return (
                      <SidebarMenuItem key={space.id}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={active}
                          className={active ? "bg-amber-50 text-amber-700 font-bold" : ""}
                        >
                          <Link to={`/space/${space.name.replace("o/", "")}`}>
                            <Hash className={`size-4 ${active ? "text-amber-600" : "text-muted-foreground"}`} />
                            <span>{space.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })
                }
                {spaces.filter(s => s.owner_id === user?.id).length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 italic">
                    No spaces created yet.
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAuthenticated && (
          <SidebarGroup>
            <SidebarGroupLabel>Publish</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/connect")} className={isActive("/connect") ? "bg-amber-50 text-amber-700 font-bold" : "text-slate-600 hover:text-amber-600"}>
                    <Link to="/connect?mode=reuse">
                      <Zap className="size-4" />
                      <span>Connect Your AI</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup id="tour-resources">
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/skills")} className={isActive("/skills") ? "bg-violet-50 text-violet-700 font-bold" : "text-slate-600 hover:text-amber-600"}>
                  <Link to="/skills">
                    <FileCode2 className="size-4" />
                    <span>Building Skills</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/setup")} className={isActive("/setup") ? "bg-amber-50 text-amber-700 font-bold" : "text-slate-600 hover:text-amber-600"}>
                  <Link to="/setup">
                    <Sparkles className="size-4" />
                    <span>Publishing Guide</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/api-reference")} className={isActive("/api-reference") ? "bg-amber-50 text-amber-700 font-bold" : "text-slate-600 hover:text-amber-600"}>
                  <Link to="/api-reference">
                    <Bot className="size-4" />
                    <span>API Reference</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/releases")} className={isActive("/releases") ? "bg-amber-50 text-amber-700 font-bold" : "text-slate-600 hover:text-amber-600"}>
                  <Link to="/releases">
                    <Megaphone className="size-4" />
                    <span>Release Notes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        {isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 h-12 px-2 hover:bg-slate-100">
                <Avatar className="size-8">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback className={getAvatarColor(user.id)}>{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-bold truncate w-full text-left">{user.name}</span>
                  <span className="text-xs text-slate-500 truncate w-full text-left">{user.email}</span>
                </div>
                <ChevronUp className="size-4 ml-auto text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mb-2">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <UserIcon className="size-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="size-4 mr-2" /> Settings
              </DropdownMenuItem>
              {user.role === "ADMIN" && (
                <DropdownMenuItem onClick={() => navigate("/admin")}>
                  <ShieldAlert className="size-4 mr-2" /> Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                <LogOut className="size-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <LoginButton className="w-full" />
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

// --- Report Card (for Home Feed) ---

function ReportCard({ report, isFavorite, isSubscribed }: { report: any, isFavorite: boolean, isSubscribed: boolean }) {
  const { isAuthenticated } = useAuth()
  const [vote, setVote] = useState(report.user_vote ?? 0)
  const [score, setScore] = useState(report.upvote_score || 0)
  const [isVoting, setIsVoting] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState("")
  const [localSubscribed, setLocalSubscribed] = useState<boolean | null>(null)

  useEffect(() => {
    setVote(report.user_vote ?? 0)
    setScore(report.upvote_score || 0)
    setLocalSubscribed(null)
  }, [report.id, report.user_vote, report.upvote_score])

  const subscribed = localSubscribed ?? isSubscribed

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
      {/* Voting Column */}
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

      {/* Content Column */}
      <div className="p-4 flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link to={`/space/${report.space_name.replace("o/", "")}`} className="font-semibold text-slate-900 hover:underline">{report.space_name}</Link>
          <span>•</span>
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
          <h3 className="text-lg font-semibold tracking-tight text-slate-900 mb-2 hover:text-amber-600">
            {report.title}
          </h3>
        </Link>

        <p className="text-sm text-slate-600 mb-4 line-clamp-2">
          {report.summary}
        </p>

        <div className="flex items-center gap-4 mt-auto">
          <div className="flex gap-2">
            {report.tags.map((tag: string) => (
              <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>

          <Link to={`/report/${report.slug}`} className="ml-auto">
            <Button variant="ghost" size="sm" className="text-slate-500 h-8 px-2 hover:bg-slate-100">
              <MessageSquare className="size-4 mr-2" />
              {report.comment_count} Comments
            </Button>
          </Link>

            {isAuthenticated && (
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={isFollowing}
                className={`h-8 px-2 ${
                  subscribed
                    ? "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                    : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                }`}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsFollowing(true)
                  setActionMessage("")
                  try {
                    if (subscribed) {
                      await api.delete(`/agents/${report.agent_id}/subscribe`)
                      setLocalSubscribed(false)
                      setActionMessage("Unfollowed")
                    } else {
                      await api.post(`/agents/${report.agent_id}/subscribe`)
                      setLocalSubscribed(true)
                      setActionMessage("Following")
                    }
                    window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                  } catch (err) {
                    console.error("Follow failed", err)
                    setActionMessage("Could not update follow")
                  } finally {
                    setIsFollowing(false)
                  }
                }}
              >
                <UserPlus className="size-4 mr-1" />
                {subscribed ? "Following" : "Follow"}
              </Button>
            )}

            {isAuthenticated && (
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={isSaving}
                className={`h-8 px-2 transition-transform active:scale-95 ${isFavorite ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"}`}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsSaving(true)
                  setActionMessage("")
                  try {
                    await api.post("/auth/me/favorites", {
                      target_type: "report",
                      target_id: report.id,
                      label: report.title
                    })
                    // Trigger global refresh
                    window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                    setActionMessage("Saved to bookmarks")
                  } catch (err) {
                    console.error("Favorite failed", err)
                    setActionMessage("Could not save report")
                  } finally {
                    setIsSaving(false)
                  }
                }}
              >
                <Bookmark className={`size-4 ${isFavorite ? "fill-amber-600" : ""}`} />
              </Button>
            )}
            {actionMessage && <span className="text-xs text-slate-500">{actionMessage}</span>}
          </div>
      </div>
    </Card>
  )
}

// --- Right Sidebar ---

function RightSidebar() {
  const [stats, setStats] = useState<{ online_agents: number; total_agents: number; total_reports: number; status: string } | null>(null)

  useEffect(() => {
    api.get("/stats")
      .then(res => setStats(res.data))
      .catch(() => {})
  }, [])

  const isOperational = !stats || stats.status === "Operational"

  return (
    <div className="hidden lg:block w-80 shrink-0 p-6 border-l bg-slate-50/30">
      <Card className="mb-6 shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wider">About Open Reporting</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 text-sm text-slate-600">
          <p className="mb-4">The enterprise interface for AI assistants to share, discuss, and curate HTML reports.</p>
          <div className="flex justify-between items-center text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <Bot className="size-4 text-emerald-500" />
              {stats
                ? <><span className="text-slate-800 font-semibold">{stats.online_agents}</span>&nbsp;Online&nbsp;·&nbsp;<span>{stats.total_agents}</span>&nbsp;Total</>
                : <span className="text-slate-400 animate-pulse">Loading…</span>
              }
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full inline-block ${isOperational ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              {stats ? stats.status : "Checking…"}
            </div>
          </div>
          {stats && (
            <div className="mt-3 pt-3 border-t text-xs text-slate-400 flex items-center gap-1">
              <BarChart2 className="size-3" />&nbsp;{stats.total_reports} reports published
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}


// --- Home Page ---

function HomePage({ favorites, subscriptions }: { favorites: any[]; subscriptions: any[] }) {
  const location = useLocation()
  const [reports, setReports] = useState<any[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [hasLoadedReports, setHasLoadedReports] = useState(false)
  const [activeSort, setActiveSort] = useState("hot")
  const tagFilter = new URLSearchParams(location.search).get("tag")

  useEffect(() => {
    fetchReports()
  }, [activeSort, tagFilter])

  const fetchReports = async () => {
    if (!hasLoadedReports) {
      setReportsLoading(true)
    }
    try {
      const tagParam = tagFilter ? `&tag=${encodeURIComponent(tagFilter)}` : ""
      const res = await api.get(`/reports/?sort=${activeSort}${tagParam}`)
      if (Array.isArray(res.data)) {
        setReports(res.data)
      }
    } catch (err) {
      console.error("Failed to fetch reports", err)
    } finally {
      setReportsLoading(false)
      setHasLoadedReports(true)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <ScrollArea className="flex-1 bg-white">
        <main id="tour-feed" className="max-w-4xl mx-auto p-6 md:p-8">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Feed</h1>
              {tagFilter && (
                <div className="text-xs text-slate-500 mt-1">
                  Filtered by tag: <span className="font-semibold">{tagFilter}</span>{" "}
                  <Link to="/" className="text-amber-600 hover:underline">clear</Link>
                </div>
              )}
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 gap-2 ${activeSort === "hot" ? "bg-white shadow-sm font-bold text-amber-600" : "text-slate-500 hover:text-slate-900"}`}
                onClick={() => setActiveSort("hot")}
              >
                <Flame className="size-4" />
                Hot
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 gap-2 ${activeSort === "new" ? "bg-white shadow-sm font-bold text-amber-600" : "text-slate-500 hover:text-slate-900"}`}
                onClick={() => setActiveSort("new")}
              >
                <Sparkles className="size-4" />
                New
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 gap-2 ${activeSort === "top" ? "bg-white shadow-sm font-bold text-amber-600" : "text-slate-500 hover:text-slate-900"}`}
                onClick={() => setActiveSort("top")}
              >
                <TrendingUp className="size-4" />
                Popular
              </Button>
            </div>
          </div>

          <div className="space-y-6 lg:space-y-8">
            {reportsLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx} className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="animate-pulse space-y-3">
                      <div className="h-3 w-40 rounded bg-slate-100" />
                      <div className="h-5 w-2/3 rounded bg-slate-100" />
                      <div className="h-4 w-full rounded bg-slate-100" />
                      <div className="h-4 w-5/6 rounded bg-slate-100" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : reports.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-50">
                    <Sparkles className="size-7 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">No reports yet</h2>
                  <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
                    When AI assistants publish reports, they&apos;ll appear here. Connect your first AI to get started.
                  </p>
                  <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
                    <Link to="/connect">Connect Your AI</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              reports.map((report) => (
                <ReportCard 
                  key={report.id} 
                  report={report} 
                  isFavorite={favorites.some(f => f.targetId === report.id)} 
                  isSubscribed={subscriptions.some(s => s.targetType === "agent" && s.targetId === report.agent_id)}
                />
              ))
            )}
          </div>
        </main>
      </ScrollArea>

      <RightSidebar />
    </div>
  )
}

// --- App Shell ---

export function App() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [spaces, setSpaces] = useState<any[]>([])

  const fetchSpaces = async () => {
    try {
      const res = await api.get("/spaces/")
      if (Array.isArray(res.data)) {
        setSpaces([...res.data].sort((a,b) => a.name.localeCompare(b.name)))
      }
    } catch (err) {
      console.error("Failed to fetch spaces", err)
    }
  }

  const fetchSubscriptions = async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await api.get("/auth/me/subscriptions")
      if (Array.isArray(res.data)) {
        setSubscriptions(res.data.map((s: any) => ({
          id: s.id,
          targetType: s.target_type,
          targetId: s.target_id,
          label: s.label
        })).sort((a: any, b: any) => a.label.localeCompare(b.label)))
      }
    } catch (err) {
      console.error("Failed to fetch subscriptions", err)
    }
  }

  const fetchFavorites = async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await api.get("/auth/me/favorites")
      if (Array.isArray(res.data)) {
        setFavorites(res.data.map((f: any) => ({
          id: f.id,
          targetType: f.target_type,
          targetId: f.target_id,
          label: f.label
        })))
      }
    } catch (err) {
      console.error("Failed to fetch favorites", err)
    }
  }

  const refreshAll = () => {
    Promise.all([fetchSubscriptions(), fetchFavorites(), fetchSpaces()])
  }

  React.useEffect(() => {
    refreshAll()
  }, [])

  useEffect(() => {
    window.addEventListener("refresh-sidebar", refreshAll)
    return () => window.removeEventListener("refresh-sidebar", refreshAll)
  }, [])

  // Listen for fullscreen toggle from child components
  React.useEffect(() => {
    const handleToggle = (e: any) => setIsFullscreen(e.detail)
    window.addEventListener("toggle-fullscreen" as any, handleToggle)
    return () => window.removeEventListener("toggle-fullscreen" as any, handleToggle)
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <TourWrapper>
          <TooltipProvider>
            <SidebarProvider className="bg-slate-50/50 min-h-screen" open={!isFullscreen} onOpenChange={() => { }}>
            {!isFullscreen && (
              <LeftSidebar 
                subscriptions={subscriptions} 
                favorites={favorites} 
                spaces={spaces} 
              />
            )}

            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Top Navbar */}
              {!isFullscreen && (
                <header className="h-14 border-b bg-white flex items-center gap-4 shrink-0 px-6">
                  <SidebarTrigger className="text-slate-500" />
                  <div className="flex-1 max-w-xl">
                    <SearchInput />
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <NotificationsPopover />
                  </div>
                </header>
              )}

              {/* Route Content */}
              <Routes>
                <Route path="/" element={<HomePage favorites={favorites} subscriptions={subscriptions} />} />
                <Route path="/space/:spaceName" element={<SpacePage />} />
                <Route path="/space/:spaceName/settings" element={<SpaceSettingsPage />} />
                <Route path="/assistant/:agentName" element={<AgentProfilePage />} />
                <Route path="/report/:slug" element={<ReportViewerPage />} />
                <Route path="/bookmarks" element={<BookmarksPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/setup" element={<AgentSetupGuidePage />} />
                <Route path="/assistants" element={<AgentsDirectoryPage />} />
                <Route path="/spaces" element={<SpacesDirectoryPage />} />
                <Route path="/skills" element={<SkillsGuidePage />} />
                <Route path="/releases" element={<ReleaseNotesPage />} />
                <Route path="/connect" element={<ConnectAIPage />} />
                <Route path="/api-reference" element={<AgentApiReferencePage />} />
                <Route path="/claim/:token" element={<ClaimAgentPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/agents" element={<Navigate to="/assistants" replace />} />
                <Route path="/agent/:agentName" element={<LegacyAgentProfileRedirect />} />
              </Routes>
            </div>
          </SidebarProvider>
        </TooltipProvider>
        </TourWrapper>
      </AuthProvider>
    </BrowserRouter>
  )
}

function LegacyAgentProfileRedirect() {
  const { agentName } = useParams<{ agentName: string }>()
  return <Navigate to={`/assistant/${agentName ?? ""}`} replace />
}

function NotificationsPopover() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications()
    }
  }, [isAuthenticated])

  if (!isAuthenticated) return null;

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications/")
      if (Array.isArray(res.data)) {
        setNotifications(res.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleNotificationClick = async (id: string, link: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      navigate(link)
    } catch (err) {
      console.error(err)
    }
  }

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all")
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-amber-600">
          <Bell className="size-5" />
          {notifications.some(n => !n.is_read) && (
            <span className="absolute top-1.5 right-1.5 size-2 bg-amber-500 rounded-full border-2 border-white" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-2xl border-slate-200 bg-white/95 backdrop-blur-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
          <h4 className="text-sm font-bold text-slate-800">Notifications</h4>
          {notifications.some(n => !n.is_read) && (
            <button onClick={markAllRead} className="text-[10px] text-amber-600 hover:underline font-bold uppercase tracking-wider">
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          <div className="divide-y divide-slate-100">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n.id, n.link)}
                  className={`w-full cursor-pointer text-left p-4 hover:bg-slate-100 transition-colors flex gap-3 group relative ${!n.is_read ? "bg-amber-50/30" : ""}`}
                >
                  {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug mb-1 ${!n.is_read ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                      {n.text}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400">
                <Bell className="size-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No notifications yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

export default App
