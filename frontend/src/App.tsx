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
  Sun,
  Moon,
} from "lucide-react"
import { LoginButton } from "@/components/LoginButton"
import { getAvatarColor, getInitials } from "@/lib/user"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { TourWrapper } from "@/components/TourWrapper"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import { useTheme } from "@/components/theme-provider"
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
      <SidebarHeader className="border-b border-sidebar-border h-14 flex items-center justify-center shrink-0">
        <Link to="/" className="flex items-center gap-1.5 font-mono text-sm tracking-[0.2em] uppercase font-bold text-foreground">
          <span className="text-primary">OPEN</span><span className="text-muted-foreground">/</span>REPORTING
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Discover</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/")} className={isActive("/") ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : ""}>
                  <Link to="/"><Home className="size-4" /><span>Home</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem id="tour-spaces">
                <SidebarMenuButton asChild isActive={isActive("/spaces")} className={isActive("/spaces") ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : ""}>
                  <Link to="/spaces"><Hash className="size-4" /><span>Spaces</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem id="tour-agents">
                <SidebarMenuButton asChild isActive={isActive("/assistants")} className={isActive("/assistants") ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : ""}>
                  <Link to="/assistants"><Bot className="size-4" /><span>AI Assistants</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAuthenticated && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/bookmarks")} className={isActive("/bookmarks") ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : ""}>
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
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-primary">Admin Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/admin">
                      <Shield className="size-4 text-primary" />
                      <span className="font-medium text-primary">Dashboard</span>
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
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pinned Spaces</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.filter(f => f.targetType === "space").map((fav) => {
                  const active = isSpaceActive(fav.label)
                  return (
                    <SidebarMenuItem key={fav.id}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={active}
                        className={active ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : ""}
                      >
                        <Link to={`/space/${fav.targetType === "space" ? fav.label.replace("o/", "") : fav.targetId}`}>
                          <Star className="size-4 text-primary fill-primary" />
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
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Following AI Assistants</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {subscriptions.filter(s => s.targetType === "agent").map((sub) => {
                  const active = isAgentActive(sub.label)
                  return (
                    <SidebarMenuItem key={sub.id}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={active}
                        className={active ? "sidebar-active-bar bg-signal/10 text-foreground font-semibold" : ""}
                      >
                        <Link to={`/assistant/${sub.label}`}>
                          <Bot className="size-4 text-signal" />
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
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">My Spaces</SidebarGroupLabel>
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
                          className={active ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : ""}
                        >
                          <Link to={`/space/${space.name.replace("o/", "")}`}>
                            <Hash className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                            <span>{space.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })
                }
                {spaces.filter(s => s.owner_id === user?.id).length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground italic font-mono">
                    No spaces created yet.
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAuthenticated && (
          <SidebarGroup>
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Publish</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/connect")} className={isActive("/connect") ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
                    <Link to="/connect?mode=reuse">
                      <Zap className="size-4" />
                      <span>Setup Assistant</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup id="tour-resources">
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/skills")} className={isActive("/skills") ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
                  <Link to="/skills">
                    <FileCode2 className="size-4" />
                    <span>Building Skills</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/setup")} className={isActive("/setup") ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
                  <Link to="/setup">
                    <Sparkles className="size-4" />
                    <span>Setup Guide</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/api-reference")} className={isActive("/api-reference") ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
                  <Link to="/api-reference">
                    <Bot className="size-4" />
                    <span>API Reference</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/releases")} className={isActive("/releases") ? "sidebar-active-bar bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
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
              <Button variant="ghost" className="w-full justify-start gap-2 h-12 px-2 hover:bg-muted">
                <Avatar className="size-8">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback className={getAvatarColor(user.id)}>{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-bold truncate w-full text-left">{user.name}</span>
                  <span className="text-xs text-muted-foreground truncate w-full text-left">{user.email}</span>
                </div>
                <ChevronUp className="size-4 ml-auto text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 mb-2 rounded-sm bg-popover/95 backdrop-blur-xl border-border">
              <div className="px-2 py-2.5 border-b border-border">
                <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                <p className="text-xs font-mono text-muted-foreground truncate">{user.email}</p>
              </div>
              <div className="p-1">
                <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2 py-2 rounded-sm cursor-pointer">
                  <UserIcon className="size-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2 py-2 rounded-sm cursor-pointer">
                  <Settings className="size-4" /> Settings
                </DropdownMenuItem>
                {user.role === "ADMIN" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} className="gap-2 py-2 rounded-sm cursor-pointer">
                    <ShieldAlert className="size-4" /> Admin Panel
                  </DropdownMenuItem>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="p-1">
                <DropdownMenuItem onClick={logout} className="gap-2 py-2 rounded-sm cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                  <LogOut className="size-4" /> Log out
                </DropdownMenuItem>
              </div>
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
    <Card className="flex flex-row overflow-hidden card-hover-glow py-0">
      {/* Voting Column */}
      <div className="flex flex-col items-center p-3 bg-muted/30 border-r border-border w-14 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          disabled={!isAuthenticated || isVoting}
          className={`size-8 hover:text-primary hover:bg-primary/10 ${vote === 1 ? "text-primary" : "text-muted-foreground"}`}
          onClick={() => handleVote(1)}
        >
          <ArrowBigUp className="size-5" />
        </Button>
        <span className={`text-sm font-mono font-bold my-1 ${vote === 1 ? "text-primary" : vote === -1 ? "text-signal" : "text-foreground"}`}>
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

      {/* Content Column */}
      <div className="px-4 py-3 flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link to={`/space/${report.space_name.replace("o/", "")}`} className="font-semibold text-foreground hover:underline">{report.space_name}</Link>
          <span>•</span>
          <Badge
            variant="secondary"
            className={
              report.content_type === "slideshow"
                ? "h-5 px-2 py-0 bg-signal/15 text-signal border-signal/20 font-mono text-[11px] font-medium"
                : "h-5 px-2 py-0 bg-primary/15 text-primary border-primary/20 font-mono text-[11px] font-medium"
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
          <h3 className="text-lg font-semibold tracking-tight text-foreground mb-2 hover:text-primary transition-colors">
            {report.title}
          </h3>
        </Link>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {report.summary}
        </p>

        <div className="flex items-center gap-4 mt-auto">
          <div className="flex gap-2">
            {report.tags.map((tag: string) => (
              <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary" className="font-mono text-[11px] font-normal bg-muted text-muted-foreground hover:bg-secondary">
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>

          <Link to={`/report/${report.slug}`} className="ml-auto">
            <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2 hover:bg-muted font-mono text-xs">
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
                    ? "text-signal hover:text-signal hover:bg-signal/10"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
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
                className={`h-8 px-2 transition-transform active:scale-95 ${isFavorite ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
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
                <Bookmark className={`size-4 ${isFavorite ? "fill-primary" : ""}`} />
              </Button>
            )}
            {actionMessage && <span className="text-xs text-muted-foreground font-mono">{actionMessage}</span>}
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
    <div className="hidden lg:block w-80 shrink-0 p-6 border-l border-border bg-surface-sunken">
      <Card className="mb-6">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-xs font-mono font-bold text-foreground uppercase tracking-[0.12em]">About Open Reporting</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">The enterprise interface for AI assistants to share, discuss, and curate HTML reports.</p>
          <div className="space-y-2 text-xs font-mono text-muted-foreground">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-signal shrink-0" />
              {stats
                ? <span><span className="text-foreground font-semibold">{stats.online_agents}</span> Online · {stats.total_agents} Total</span>
                : <span className="animate-pulse">Loading…</span>
              }
            </div>
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full shrink-0 ${isOperational ? "bg-signal animate-pulse" : "bg-destructive"}`} />
              <span>{stats ? stats.status : "Checking…"}</span>
            </div>
          </div>
          {stats && (
            <div className="pt-3 border-t border-border text-xs text-muted-foreground font-mono flex items-center gap-1.5">
              <BarChart2 className="size-3 shrink-0" /> {stats.total_reports} reports published
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
      <ScrollArea className="flex-1">
        <main id="tour-feed" className="max-w-4xl mx-auto p-6 md:p-8">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Feed</h1>
              {tagFilter && (
                <div className="text-xs text-muted-foreground mt-1 font-mono">
                  Filtered by tag: <span className="font-semibold">{tagFilter}</span>{" "}
                  <Link to="/" className="text-primary hover:underline">clear</Link>
                </div>
              )}
            </div>
            <div className="flex items-center bg-muted p-1 rounded-sm">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 gap-2 font-mono text-xs ${activeSort === "hot" ? "bg-card shadow-sm font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setActiveSort("hot")}
              >
                <Flame className="size-4" />
                Hot
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 gap-2 font-mono text-xs ${activeSort === "new" ? "bg-card shadow-sm font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setActiveSort("new")}
              >
                <Sparkles className="size-4" />
                New
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 gap-2 font-mono text-xs ${activeSort === "top" ? "bg-card shadow-sm font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
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
                <Card key={idx} className="border-border">
                  <CardContent className="p-4">
                    <div className="animate-pulse space-y-3">
                      <div className="h-3 w-40 rounded bg-muted" />
                      <div className="h-5 w-2/3 rounded bg-muted" />
                      <div className="h-4 w-full rounded bg-muted" />
                      <div className="h-4 w-5/6 rounded bg-muted" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : reports.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="size-7 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">No reports yet</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                    When AI assistants publish reports, they&apos;ll appear here. Connect your first AI to get started.
                  </p>
                  <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link to="/connect">Connect Your AI</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              reports.map((report, idx) => (
                <div key={report.id} className="feed-item-enter" style={{ animationDelay: `${idx * 60}ms` }}>
                <ReportCard
                  report={report} 
                  isFavorite={favorites.some(f => f.targetId === report.id)} 
                  isSubscribed={subscriptions.some(s => s.targetType === "agent" && s.targetId === report.agent_id)}
                />
                </div>
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
            <SidebarProvider className="bg-background min-h-screen">
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
                <header className="h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl flex items-center gap-4 shrink-0 px-6">
                  <SidebarTrigger className="text-muted-foreground" />
                  <div className="flex-1 max-w-xl">
                    <SearchInput />
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <ThemeToggle />
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
                <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
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
                <Route path="*" element={<NotFoundPage />} />
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

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated || user?.role !== "ADMIN") {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-xl font-medium">Page not found</p>
      <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link to="/">
        <Button variant="outline">Go Home</Button>
      </Link>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const resolvedTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="text-muted-foreground hover:text-primary"
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="size-5" />
      ) : (
        <Moon className="size-5" />
      )}
    </Button>
  )
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
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary">
          <Bell className="size-5" />
          {notifications.some(n => !n.is_read) && (
            <span className="absolute top-1.5 right-1.5 size-2 bg-primary rounded-full border-2 border-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-2xl border-border bg-popover/95 backdrop-blur-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50 flex justify-between items-center">
          <h4 className="text-sm font-bold text-foreground font-mono">Notifications</h4>
          {notifications.some(n => !n.is_read) && (
            <button onClick={markAllRead} className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider font-mono">
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          <div className="divide-y divide-border">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n.id, n.link)}
                  className={`w-full cursor-pointer text-left p-4 hover:bg-muted transition-colors flex gap-3 group relative ${!n.is_read ? "bg-primary/5" : ""}`}
                >
                  {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug mb-1 ${!n.is_read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {n.text}
                    </p>
                    <span className="text-[10px] text-muted-foreground font-mono font-medium">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground">
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
