import { Link } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAvatarColor, getInitials } from "@/lib/user"
import {
  Mail,
  Shield,
  Star,
  FileText,
  LogOut,
  Calendar,
} from "lucide-react"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"

import { type Favorite } from "@/types"

export function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth()

  const { data: stats = { comments_count: 0, favorites_count: 0, upvotes_given: 0, reports_viewed: 0 } } = useQuery({
    queryKey: ["profile-stats"],
    queryFn: async () => (await api.get("/auth/me/stats")).data,
    enabled: isAuthenticated && !!user,
    staleTime: 30_000,
  })

  const { data: favorites = [], isLoading: favoritesLoading } = useQuery<Favorite[]>({
    queryKey: ["profile-favorites"],
    queryFn: async () => {
      const res = await api.get("/auth/me/favorites")
      return res.data.map((f: { id: string; target_type: string; target_id: string; label: string }) => ({
        id: f.id,
        targetType: f.target_type,
        targetId: f.target_id,
        label: f.label
      }))
    },
    enabled: isAuthenticated && !!user,
    staleTime: 30_000,
  })

  if (!isAuthenticated || !user) {
    return (
      <ScrollArea className="flex-1">
        <main className="max-w-3xl mx-auto p-6 md:p-8">
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-foreground mb-2">Not signed in</h1>
            <p className="text-muted-foreground">Please sign in to view your profile.</p>
          </div>
        </main>
      </ScrollArea>
    )
  }

  const joinedString = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })

  return (
    <ScrollArea className="flex-1">
      <main className="max-w-3xl mx-auto p-6 md:p-8">
        {/* Profile Header */}
        <Card className="mb-8 overflow-hidden py-0 rounded-sm">
          <div className="h-28 bg-gradient-to-r from-slate-800 via-slate-700 to-amber-600" />
          <div className="relative pt-0 pb-8 px-6 flex flex-col items-center text-center">
            <div className="-mt-12 mb-4">
              <Avatar className="size-24 ring-2 ring-background shadow-lg">
                {user.avatar && <AvatarImage src={user.avatar} className="object-cover" />}
                <AvatarFallback className={`text-2xl font-bold ${getAvatarColor(user.name || user.id)}`}>
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">{user.name}</h1>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Mail className="size-4" />
                {user.email}
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="size-4" />
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"} className="font-medium whitespace-nowrap">
                  {user.role.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="size-4" />
                Joined {joinedString}
              </div>
            </div>
          </div>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="text-center p-4 rounded-sm">
            <p className="text-3xl font-bold font-mono text-foreground">{stats.favorites_count}</p>
            <p className="text-sm text-muted-foreground">Favorites</p>
          </Card>
          <Card className="text-center p-4 rounded-sm">
            <p className="text-3xl font-bold font-mono text-foreground">{stats.upvotes_given}</p>
            <p className="text-sm text-muted-foreground">Upvotes Given</p>
          </Card>
          <Card className="text-center p-4 rounded-sm">
            <p className="text-3xl font-bold font-mono text-foreground">{stats.comments_count}</p>
            <p className="text-sm text-muted-foreground">Comments</p>
          </Card>
        </div>

        {/* Favorites List */}
        <div className="mb-8">
          <div className="mb-4">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Your Favorites</span>
          </div>
          <div className="border rounded-sm overflow-hidden">
            {favoritesLoading ? (
              <div className="divide-y">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-6 py-3 animate-pulse">
                    <div className="h-4 w-40 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : favorites.length > 0 ? (
              <ul className="divide-y">
                {favorites.map((fav, idx) => (
                  <li
                    key={fav.id}
                    className="feed-item-enter border-l-2 border-l-primary/20 hover:border-l-primary transition-colors"
                    style={{ animationDelay: `${Math.min(idx * 60, 480)}ms` }}
                  >
                    <Link
                      to={fav.targetType === "space" ? `/space/${fav.label.replace("o/", "")}` : `/report/${fav.targetId}`}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors"
                    >
                      {fav.targetType === "space" ? (
                        <Star className="size-4 text-primary fill-primary shrink-0" />
                      ) : (
                        <FileText className="size-4 text-primary shrink-0" />
                      )}
                      <span className="text-sm font-medium text-foreground">{fav.label}</span>
                      <Badge variant="outline" className="ml-auto text-xs capitalize font-mono">{fav.targetType}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">No favorites yet.</div>
            )}
          </div>
        </div>

        {/* Account Actions */}
        <div className="mb-8">
          <div className="mb-4">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Account</span>
          </div>
          <div className="border rounded-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Sign out</p>
                <p className="text-xs text-muted-foreground">You are signed in via <span className="capitalize">{user.provider}</span></p>
              </div>
              <Button variant="outline" size="sm" onClick={logout} className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive gap-2">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </main>
    </ScrollArea>
  )
}
