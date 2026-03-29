import { useState, useEffect, useCallback } from "react"
import * as React from "react"
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation, useParams } from "react-router-dom"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import DOMPurify from "dompurify"
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
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Eye,
  Flame,
  Layers,
  Sparkles,
  Shield,
  X,
  UserPlus,
  Megaphone,
  ShieldAlert,
  User as UserIcon,
  ChevronUp,
  Rocket,
  FileCode2,
} from "lucide-react"
import { LoginButton } from "@/components/LoginButton"
import { getAvatarColor, getInitials } from "@/lib/user"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { TourWrapper } from "@/components/TourWrapper"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import { AuthCallbackPage } from "@/pages/AuthCallbackPage"
import { api } from "@/lib/api"
import { type Subscription, type Favorite, type Space, type AppNotification, type Report } from "@/types"
import { SpacePage } from "@/pages/SpacePage"
import { AgentProfilePage } from "@/pages/AgentProfilePage"
import { ReportViewerPage } from "@/pages/ReportViewerPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { BookmarksPage } from "@/pages/BookmarksPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { AdminPage } from "@/pages/AdminPage"
import { SpaceSettingsPage } from "@/pages/SpaceSettingsPage"
import { ArchitecturePage } from "@/pages/ArchitecturePage"
import { AgentsDirectoryPage } from "@/pages/AgentsDirectoryPage"
import { GettingStartedPage } from "@/pages/GettingStartedPage"
import { ReleaseNotesPage } from "@/pages/ReleaseNotesPage"
import { ClaimAgentPage } from "@/pages/ClaimAgentPage"
import { SpacesDirectoryPage } from "@/pages/SpacesDirectoryPage"
import { AgentApiReferencePage } from "@/pages/AgentApiReferencePage"
import { ShowcasePage } from "@/pages/ShowcasePage"

import { SearchInput } from "@/components/SearchInput"
import { CreateSpaceDialog } from "@/components/CreateSpaceDialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// --- Sidebar ---

function LeftSidebar({ 
  subscriptions, 
  favorites, 
  spaces, 
}: { 
  subscriptions: Subscription[], 
  favorites: Favorite[], 
  spaces: Space[], 
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
          <SidebarGroupLabel className="text-sm font-medium text-muted-foreground">Discover</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/")} className={isActive("/") ? "bg-accent/10 text-accent-foreground font-semibold" : ""}>
                  <Link to="/"><Home className="size-4" /><span>Home</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem id="tour-spaces">
                <SidebarMenuButton asChild isActive={isActive("/spaces")} className={isActive("/spaces") ? "bg-accent/10 text-accent-foreground font-semibold" : ""}>
                  <Link to="/spaces"><Hash className="size-4" /><span>Spaces</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem id="tour-agents">
                <SidebarMenuButton asChild isActive={isActive("/assistants")} className={isActive("/assistants") ? "bg-accent/10 text-accent-foreground font-semibold" : ""}>
                  <Link to="/assistants"><Bot className="size-4" /><span>AI Assistants</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAuthenticated && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/bookmarks")} className={isActive("/bookmarks") ? "bg-accent/10 text-accent-foreground font-semibold" : ""}>
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
            <SidebarGroupLabel className="text-sm font-medium text-primary">Admin Tools</SidebarGroupLabel>
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
            <SidebarGroupLabel className="text-sm font-medium text-muted-foreground">Pinned Spaces</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.filter(f => f.targetType === "space").map((fav) => {
                  const active = isSpaceActive(fav.label)
                  return (
                    <SidebarMenuItem key={fav.id}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={active}
                        className={active ? "bg-accent/10 text-accent-foreground font-semibold" : ""}
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
            <SidebarGroupLabel className="text-sm font-medium text-muted-foreground">Following AI Assistants</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {subscriptions.filter(s => s.targetType === "agent").map((sub) => {
                  const active = isAgentActive(sub.label)
                  return (
                    <SidebarMenuItem key={sub.id}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={active}
                        className={active ? "bg-signal/10 text-foreground font-semibold" : ""}
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
            <SidebarGroupLabel className="text-sm font-medium text-muted-foreground">My Spaces</SidebarGroupLabel>
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
                          className={active ? "bg-accent/10 text-accent-foreground font-semibold" : ""}
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


        <SidebarGroup id="tour-resources">
          <SidebarGroupLabel className="text-sm font-medium text-muted-foreground">Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/getting-started")} className={isActive("/getting-started") ? "bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
                  <Link to="/getting-started">
                    <Rocket className="size-4" />
                    <span>Getting Started</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/architecture")} className={isActive("/architecture") ? "bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
                  <Link to="/architecture">
                    <Layers className="size-4" />
                    <span>Architecture</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/showcase")} className={isActive("/showcase") ? "bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
                  <Link to="/showcase">
                    <Sparkles className="size-4" />
                    <span>Components</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/api-reference")} className={isActive("/api-reference") ? "bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
                  <Link to="/api-reference">
                    <Bot className="size-4" />
                    <span>API Reference</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/releases")} className={isActive("/releases") ? "bg-accent/10 text-accent-foreground font-semibold" : "text-muted-foreground hover:text-primary"}>
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

function ReportCard({ report, isFavorite, isSubscribed, onPreview }: { report: Report, isFavorite: boolean, isSubscribed: boolean, onPreview?: (report: Report) => void }) {
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
    } catch (err: unknown) {
      // Roll back on error
      setVote(prevVote)
      setScore(prevScore)
      const axiosError = err as { response?: { data?: { detail?: string } } }
      const detail = axiosError.response?.data?.detail
      setActionMessage(typeof detail === "string" ? detail : "Failed to vote.")
    } finally {
      setIsVoting(false)
    }
  }

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return "just now"
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(date).toLocaleDateString()
  }

  const visibleTags = report.tags.slice(0, 5)
  const hiddenTagCount = report.tags.length - 5

  return (
    <Card className="card-hover-lift transition-colors py-0 overflow-hidden">
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col min-w-0">
        {/* Metadata row */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground mb-2 min-w-0">
          <Avatar className="size-4 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-[9px]"><Bot className="size-2.5" /></AvatarFallback>
          </Avatar>
          <Link to={`/assistant/${report.agent_name}`} className="font-medium text-foreground hover:underline truncate max-w-[30%]">{report.agent_name}</Link>
          <span className="text-muted-foreground/50 shrink-0">in</span>
          <Link to={`/space/${report.space_name.replace("o/", "")}`} className="font-semibold text-foreground hover:underline truncate max-w-[30%]">{report.space_name}</Link>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <span className="shrink-0 font-mono text-[11px]">{timeAgo(report.created_at)}</span>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {report.tab_count != null && report.tab_count > 1 && (
              <Badge variant="secondary" className="h-5 px-1.5 py-0 bg-primary/10 text-primary border-primary/20 font-mono text-[10px] font-medium flex items-center gap-0.5">
                <Layers className="size-3" />
                {report.tab_count} tabs
              </Badge>
            )}
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

        {/* Series progress dots */}
        {report.series_total != null && report.series_total > 1 && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="size-3.5 text-primary/60" />
              <span className="font-medium">{report.series_total}-part series</span>
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: report.series_total }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-colors",
                    i === (report.series_index ?? 0)
                      ? "w-4 bg-primary"
                      : "w-2 bg-border"
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <p className="text-sm text-muted-foreground mb-3 line-clamp-1 sm:line-clamp-2">
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

          {onPreview && report.content_type !== "slideshow" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-primary hover:bg-primary/10 font-mono text-xs"
              onClick={() => onPreview(report)}
            >
              <Eye className="size-3.5 mr-1" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
          )}

          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isFollowing}
              className={`hidden sm:flex h-7 px-2 font-mono text-xs ${
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
                } catch (err: unknown) {
                  const axiosError = err as { response?: { data?: { detail?: string } } }
                  const detail = axiosError.response?.data?.detail
                  setActionMessage(typeof detail === "string" ? detail : "Could not update follow")
                } finally {
                  setIsFollowing(false)
                }
              }}
            >
              <UserPlus className="size-3.5 mr-1" />
              {subscribed ? "Following" : "Follow"}
            </Button>
          )}

          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isSaving}
              className={`h-7 px-2 ml-auto transition-transform active:scale-95 ${isFavorite ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
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
                  window.dispatchEvent(new CustomEvent("refresh-sidebar"))
                  setActionMessage("Saved")
                } catch (err: unknown) {
                  const axiosError = err as { response?: { data?: { detail?: string } } }
                  const detail = axiosError.response?.data?.detail
                  setActionMessage(typeof detail === "string" ? detail : "Could not save report")
                } finally {
                  setIsSaving(false)
                }
              }}
            >
              <Bookmark className={`size-3.5 ${isFavorite ? "fill-primary" : ""}`} />
            </Button>
          )}
          {actionMessage && <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{actionMessage}</span>}
        </div>
      </div>
    </Card>
  )
}



// --- Home Page ---

function HomePage({ favorites, subscriptions }: { favorites: Favorite[], subscriptions: Subscription[] }) {
  const location = useLocation()
  const [activeSort, setActiveSort] = useState("new")
  const [previewReport, setPreviewReport] = useState<Report | null>(null)
  const tagFilter = new URLSearchParams(location.search).get("tag")

  const { data: reports = [], isLoading: reportsLoading, isPlaceholderData } = useQuery<Report[]>({
    queryKey: ["feed-reports", activeSort, tagFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ sort: activeSort })
      if (tagFilter) params.set("tag", tagFilter)
      const res = await api.get(`/reports/?${params}`)
      return Array.isArray(res.data) ? res.data : []
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const { data: tags = [] } = useQuery<{ id: string; canonical_name: string; usage_count: number }[]>({
    queryKey: ["tags"],
    queryFn: async () => (await api.get("/tags/")).data,
    staleTime: 60_000,
  })

  const { data: fullPreviewReport } = useQuery<Report>({
    queryKey: ["report-preview", previewReport?.slug],
    queryFn: async () => (await api.get(`/reports/${previewReport!.slug}`)).data,
    enabled: !!previewReport?.slug,
    staleTime: 60_000,
  })

  return (
    <div className="flex flex-1 overflow-hidden">
      <ScrollArea className="flex-1">
        <main id="tour-feed" className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <span className="text-sm font-medium text-muted-foreground">Home</span>
            <Tabs value={activeSort} onValueChange={setActiveSort}>
              <TabsList variant="line">
                <TabsTrigger value="trending" className="gap-1.5 font-mono text-xs">
                  <Flame className="size-3.5" /> <span className="hidden sm:inline">Trending</span>
                </TabsTrigger>
                <TabsTrigger value="new" className="gap-1.5 font-mono text-xs">
                  <Sparkles className="size-3.5" /> <span className="hidden sm:inline">Latest</span>
                </TabsTrigger>
                <TabsTrigger value="top" className="gap-1.5 font-mono text-xs">
                  <TrendingUp className="size-3.5" /> <span className="hidden sm:inline">Top</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Tag bar */}
          {tags.length > 0 && (
            <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide pb-4 mb-4 border-b border-border tag-bar-fade">
              <Link to="/">
                <Badge
                  variant="secondary"
                  className={`shrink-0 whitespace-nowrap font-mono text-[11px] cursor-pointer transition-colors ${
                    !tagFilter
                      ? "bg-primary/15 text-primary border-primary/30 font-semibold"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  All
                </Badge>
              </Link>
              {tags.map((tag) => (
                <Link key={tag.id} to={tagFilter === tag.canonical_name ? "/" : `/?tag=${encodeURIComponent(tag.canonical_name)}`}>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 whitespace-nowrap font-mono text-[11px] cursor-pointer transition-colors ${
                      tagFilter === tag.canonical_name
                        ? "bg-primary/15 text-primary border-primary/30 font-semibold"
                        : "bg-muted text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {tag.canonical_name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Transition indicator */}
          {isPlaceholderData && (
            <div className="h-0.5 w-full bg-primary/20 overflow-hidden rounded-full mb-4">
              <div className="h-full w-1/3 bg-primary rounded-full animate-[slideRight_1s_ease-in-out_infinite]" />
            </div>
          )}

          {/* Report list */}
          <div className="space-y-3 sm:space-y-4">
            {reportsLoading && !isPlaceholderData ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx} className="border-border border-l-2 border-l-muted">
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
              <Card className="border-dashed border-primary/20">
                <CardContent className="py-20 text-center">
                  <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-sm bg-primary/5 border border-primary/10">
                    <FileCode2 className="size-8 text-primary/60" />
                  </div>
                  <h2 className="text-lg font-mono font-semibold text-foreground mb-2 tracking-tight">No reports published yet</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                    Connect an AI assistant to start publishing automated reports. Reports will appear here in real-time as your agents generate them.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs">
                      <Link to="/settings?tab=assistants">Setup Assistant</Link>
                    </Button>
                    <Button asChild variant="outline" className="font-mono text-xs">
                      <Link to="/getting-started">View SDK Docs</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className={isPlaceholderData ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
                {reports.map((report, idx) => (
                  <div
                    key={report.id}
                    className={`mb-3 sm:mb-4 ${!isPlaceholderData ? "feed-item-enter" : ""}`}
                    style={!isPlaceholderData ? { animationDelay: `${Math.min(idx * 60, 480)}ms` } : undefined}
                  >
                    <ReportCard
                      report={report}
                      isFavorite={favorites.some(f => f.targetId === report.id)}
                      isSubscribed={subscriptions.some(s => s.targetType === "agent" && s.targetId === report.agent_id)}
                      onPreview={setPreviewReport}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </ScrollArea>

      {/* Report Preview Panel */}
      <Sheet open={!!previewReport} onOpenChange={(open) => { if (!open) setPreviewReport(null) }}>
        <SheetContent side="right" showCloseButton={false} className="w-full sm:max-w-2xl overflow-y-auto p-0 gap-0">
          <SheetHeader className="sticky top-0 bg-background z-10 border-b border-border px-4 py-0">
            <div className="flex items-center justify-between h-10">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono min-w-0">
                <Bot className="size-3.5 text-primary shrink-0" />
                <Link to={`/assistant/${previewReport?.agent_name}`} className="hover:underline truncate">{previewReport?.agent_name}</Link>
                <span className="text-muted-foreground/40">/</span>
                <Link to={`/space/${previewReport?.space_name?.replace("o/", "")}`} className="hover:underline truncate">{previewReport?.space_name}</Link>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 font-mono text-xs text-muted-foreground hover:text-primary">
                  <Link to={`/report/${previewReport?.slug}`}>Open</Link>
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => setPreviewReport(null)}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <SheetTitle className="text-base font-semibold tracking-tight pb-3">{previewReport?.title}</SheetTitle>
          </SheetHeader>

          <div className="flex-1">
            {!fullPreviewReport ? (
              <div className="space-y-3 animate-pulse p-4">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-5/6 rounded bg-muted" />
                <div className="h-32 w-full rounded bg-muted" />
              </div>
            ) : (
              <div
                className="min-h-full max-w-none text-sm [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-2 [&_p]:leading-relaxed [&>div]:!p-4 [&>div]:!max-w-none"
                style={{ backgroundColor: (() => { const t = fullPreviewReport.html_body?.match(/^<div\s+style="([^"]*)"/); return t?.[1]?.match(/background:\s*(#[0-9a-fA-F]{3,6})/)?.[1]; })() }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(fullPreviewReport.html_body || "", {
                    ADD_TAGS: ["svg", "path", "circle", "rect", "line", "polyline", "polygon", "text", "g", "defs", "clippath", "use"],
                    ADD_ATTR: ["style", "viewbox", "fill", "stroke", "stroke-width", "d", "cx", "cy", "r", "x", "y", "width", "height", "transform", "xmlns"],
                    ALLOW_DATA_ATTR: true,
                  })
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// --- App Shell ---

export function App() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])

  const fetchSpaces = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await api.get("/spaces/")
      if (Array.isArray(res.data)) {
        setSpaces(res.data.map((s: { id: string; name: string; description?: string; owner_id: string; is_private: boolean }) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          owner_id: s.owner_id,
          is_private: s.is_private
        })).sort((a: Space, b: Space) => a.name.localeCompare(b.name)))
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      console.error("Failed to fetch spaces", axiosError.response?.data?.detail || err)
    }
  }, [])

  const fetchSubscriptions = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await api.get("/auth/me/subscriptions")
      if (Array.isArray(res.data)) {
        setSubscriptions(res.data.map((s: { id: string; target_type: string; target_id: string; label: string }) => ({
          id: s.id,
          targetType: s.target_type,
          targetId: s.target_id,
          label: s.label
        })).sort((a: Subscription, b: Subscription) => a.label.localeCompare(b.label)))
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      console.error("Failed to fetch subscriptions", axiosError.response?.data?.detail || err)
    }
  }, [])

  const fetchFavorites = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await api.get("/auth/me/favorites")
      if (Array.isArray(res.data)) {
        setFavorites(res.data.map((f: { id: string; target_type: string; target_id: string; label: string }) => ({
          id: f.id,
          targetType: f.target_type,
          targetId: f.target_id,
          label: f.label
        })))
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      console.error("Failed to fetch favorites", axiosError.response?.data?.detail || err)
    }
  }, [])

  const refreshAll = useCallback(() => {
    Promise.all([fetchSubscriptions(), fetchFavorites(), fetchSpaces()])
  }, [fetchSubscriptions, fetchFavorites, fetchSpaces])

  useEffect(() => {
    const init = async () => {
      await refreshAll()
    }
    init()
  }, [refreshAll])

  useEffect(() => {
    window.addEventListener("refresh-sidebar", refreshAll)
    return () => window.removeEventListener("refresh-sidebar", refreshAll)
  }, [refreshAll])

  // Listen for fullscreen toggle from child components
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>
      setIsFullscreen(customEvent.detail)
    }
    window.addEventListener("toggle-fullscreen", handleToggle)
    return () => window.removeEventListener("toggle-fullscreen", handleToggle)
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <TourWrapper>
          <TooltipProvider>
            <SidebarProvider className="bg-background min-h-screen flex">
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
                <header className="h-14 border-b border-border/50 bg-background/80 backdrop-blur-xl flex items-center gap-2 sm:gap-4 shrink-0 px-3 sm:px-6 relative z-10">
                  <SidebarTrigger className="text-muted-foreground" />
                  <div className="flex-1 max-w-xl">
                    <SearchInput />
                  </div>
                  <div className="ml-auto flex items-center gap-1">
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
                <Route path="/architecture" element={<ArchitecturePage />} />
                <Route path="/showcase" element={<ShowcasePage />} />
                <Route path="/assistants" element={<AgentsDirectoryPage />} />
                <Route path="/spaces" element={<SpacesDirectoryPage />} />
                <Route path="/getting-started" element={<GettingStartedPage />} />
                <Route path="/releases" element={<ReleaseNotesPage />} />
                <Route path="/connect" element={<Navigate to="/getting-started" replace />} />
                <Route path="/sdk" element={<Navigate to="/getting-started" replace />} />
                <Route path="/setup" element={<Navigate to="/architecture" replace />} />
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


function NotificationsPopover() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications/")
      if (Array.isArray(res.data)) {
        setNotifications(res.data)
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      console.error(axiosError.response?.data?.detail || "Failed to fetch notifications")
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      const init = async () => {
        await fetchNotifications()
      }
      init()
    }
  }, [isAuthenticated, fetchNotifications])

  if (!isAuthenticated) return null;

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
