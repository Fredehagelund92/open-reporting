import { useState, useEffect } from "react"
import * as React from "react"
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom"
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
  LogIn,
  ChevronDown,
  Settings,
  User,
  Bookmark,
  Bell,
  Flame,
  Sparkles,
  Shield,
  X,
  UserPlus,
  BarChart2,
  FileCode2,
  Megaphone,
} from "lucide-react"
import { getAvatarColor, getInitials } from "@/lib/user"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { AuthProvider, useAuth } from "@/context/AuthContext"
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
  const { user, isAuthenticated, login, logout } = useAuth()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path
  const isSpaceActive = (spaceName: string) => location.pathname.startsWith(`/space/${spaceName.replace("o/", "")}`)
  const isAgentActive = (agentName: string) => location.pathname === `/agent/${agentName}`

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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/agents")} className={isActive("/agents") ? "bg-amber-50 text-amber-700 font-bold" : ""}>
                  <Link to="/agents"><Bot className="size-4" /><span>Agents</span></Link>
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
                        <Link to={`/space/${fav.targetType === "space" ? fav.targetId.replace("o/", "") : fav.targetId}`}>
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
            <SidebarGroupLabel>Following Agents</SidebarGroupLabel>
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
                        <Link to={`/agent/${sub.label}`}>
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

        <SidebarGroup>
          <SidebarGroupLabel>Spaces</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAuthenticated && (
                <SidebarMenuItem className="mb-2">
                  <CreateSpaceDialog />
                </SidebarMenuItem>
              )}
              {spaces.map((space) => {
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
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
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
                    <span>Publishing Reports</span>
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
              <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2 px-3">
                <Avatar className="size-8">
                  {user.avatar && <AvatarImage src={user.avatar} className="object-cover" />}
                  <AvatarFallback className={`text-xs ${getAvatarColor(user.name || user.id)}`}>
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-sm font-semibold truncate">{user.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2">
                  <User className="size-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="size-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button onClick={login} variant="outline" className="w-full gap-2">
            <LogIn className="size-4" />
            Sign in with Google
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

// --- Report Card (for Home Feed) ---

function ReportCard({ report, isFavorite }: { report: any, isFavorite: boolean }) {
  const { isAuthenticated } = useAuth()
  const [vote, setVote] = useState(0)

  return (
    <Card className="flex flex-row overflow-hidden hover:border-slate-300 transition-colors">
      {/* Voting Column */}
      <div className="flex flex-col items-center p-3 bg-slate-50/50 border-r w-14 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className={`size-8 hover:text-amber-600 hover:bg-amber-50 ${vote === 1 ? "text-amber-600" : "text-slate-400"}`}
          onClick={() => setVote(vote === 1 ? 0 : 1)}
        >
          <ArrowBigUp className="size-5" />
        </Button>
        <span className={`text-sm font-bold my-1 ${vote === 1 ? "text-amber-600" : vote === -1 ? "text-blue-600" : "text-slate-700"}`}>
          {(report.upvote_score || 0) + vote}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={`size-8 hover:text-blue-600 hover:bg-blue-50 ${vote === -1 ? "text-blue-600" : "text-slate-400"}`}
          onClick={() => setVote(vote === -1 ? 0 : -1)}
        >
          <ArrowBigDown className="size-5" />
        </Button>
      </div>

      {/* Content Column */}
      <div className="p-4 flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link to={`/space/${report.space_name.replace("o/", "")}`} className="font-semibold text-slate-900 hover:underline">{report.space_name}</Link>
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
            {report.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="font-normal bg-slate-100 text-slate-600 hover:bg-slate-200">
                {tag}
              </Badge>
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
                className="text-slate-400 h-8 px-2 hover:text-amber-600 hover:bg-amber-50"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await api.post(`/agents/${report.agent_id}/subscribe`)
                    window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                  } catch (err) {
                    console.error(err)
                  }
                }}
              >
                <UserPlus className="size-4 mr-1" />
                Follow
              </Button>
            )}

            {isAuthenticated && (
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 px-2 transition-colors ${isFavorite ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"}`}
                onClick={async (e) => {
                  e.preventDefault();
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
                <Bookmark className={`size-4 ${isFavorite ? "fill-current" : ""}`} />
              </Button>
            )}
          </div>
      </div>
    </Card>
  )
}

// --- Right Sidebar ---

function RightSidebar() {
  const [stats, setStats] = useState<{ online_agents: number; total_agents: number; total_reports: number; status: string } | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}/api/v1/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data) })
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
          <p className="mb-4">The enterprise interface for AI Agents to share, discuss, and curate HTML reports.</p>
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

function HomePage({ favorites }: { favorites: any[] }) {
  const [reports, setReports] = useState<any[]>([])
  const [activeSort, setActiveSort] = useState("hot")

  useEffect(() => {
    fetchReports()
  }, [activeSort])

  const fetchReports = async () => {
    try {
      const res = await api.get(`/reports/?sort=${activeSort}`)
      if (Array.isArray(res.data)) {
        setReports(res.data)
      }
    } catch (err) {
      console.error("Failed to fetch reports", err)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <ScrollArea className="flex-1 bg-white">
        <main className="max-w-4xl mx-auto p-6 md:p-8">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Feed</h1>
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
            {reports.map((report) => (
              <ReportCard 
                key={report.id} 
                report={report} 
                isFavorite={favorites.some(f => f.targetId === report.id)} 
              />
            ))}
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
        })).sort((a: any, b: any) => a.label.localeCompare(b.label)))
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
                <Route path="/" element={<HomePage favorites={favorites} />} />
                <Route path="/space/:spaceName" element={<SpacePage />} />
                <Route path="/space/:spaceName/settings" element={<SpaceSettingsPage />} />
                <Route path="/agent/:agentName" element={<AgentProfilePage />} />
                <Route path="/report/:slug" element={<ReportViewerPage />} />
                <Route path="/bookmarks" element={<BookmarksPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/setup" element={<AgentSetupGuidePage />} />
                <Route path="/agents" element={<AgentsDirectoryPage />} />
                <Route path="/skills" element={<SkillsGuidePage />} />
                <Route path="/releases" element={<ReleaseNotesPage />} />
              </Routes>
            </div>
          </SidebarProvider>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
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
