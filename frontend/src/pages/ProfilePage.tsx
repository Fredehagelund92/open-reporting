import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAvatarColor, getInitials } from "@/lib/user"
import {
  ArrowLeft,
  Mail,
  Shield,
  Star,
  FileText,
  LogOut,
  Calendar,
} from "lucide-react"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"

export function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth()
  const [stats, setStats] = useState({
    comments_count: 0,
    favorites_count: 0,
    upvotes_given: 0,
    reports_viewed: 0
  })
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchProfileData()
    }
  }, [isAuthenticated, user])

  const fetchProfileData = async () => {
    setLoading(true)
    try {
      const [statsRes, favsRes] = await Promise.all([
        api.get("/auth/me/stats"),
        api.get("/auth/me/favorites")
      ])
      setStats(statsRes.data)
      setFavorites(favsRes.data)
    } catch (err) {
      console.error("Failed to fetch profile data", err)
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated || !user) {
    return (
      <ScrollArea className="flex-1 bg-card">
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
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-3xl mx-auto p-6 md:p-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to Feed
        </Link>

        {/* Profile Header */}
        <Card className="mb-8 overflow-hidden">
          <div className="h-28 bg-gradient-to-r from-slate-800 via-slate-700 to-amber-600" />
          <CardContent className="relative pt-0 pb-8 px-6 flex flex-col items-center text-center">
            <div className="-mt-12 mb-4">
              <Avatar className="size-24 ring-4 ring-white shadow-lg">
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
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="text-center p-4">
            <p className="text-3xl font-bold text-foreground">{stats.favorites_count}</p>
            <p className="text-sm text-muted-foreground">Favorites</p>
          </Card>
          <Card className="text-center p-4">
            <p className="text-3xl font-bold text-foreground">{stats.upvotes_given}</p>
            <p className="text-sm text-muted-foreground">Upvotes Given</p>
          </Card>
          <Card className="text-center p-4">
            <p className="text-3xl font-bold text-foreground">{stats.comments_count}</p>
            <p className="text-sm text-muted-foreground">Comments</p>
          </Card>
        </div>

        {/* Favorites List */}
        <Card className="mb-8">
          <CardHeader className="px-6 py-4 border-b">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Star className="size-4 text-primary fill-primary" />
              Your Favorites
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading favorites...</div>
            ) : favorites.length > 0 ? (
              <ul className="divide-y">
                {favorites.map((fav) => (
                  <li key={fav.id}>
                    <Link
                      to={fav.target_type === "space" ? `/space/${fav.label.replace("o/", "")}` : `/report/${fav.target_id}`}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-muted transition-colors"
                    >
                      {fav.target_type === "space" ? (
                        <Star className="size-4 text-primary fill-primary shrink-0" />
                      ) : (
                        <FileText className="size-4 text-primary shrink-0" />
                      )}
                      <span className="text-sm font-medium text-foreground">{fav.label}</span>
                      <Badge variant="outline" className="ml-auto text-xs capitalize">{fav.target_type}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">No favorites yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader className="px-6 py-4 border-b">
            <CardTitle className="text-base font-bold text-foreground">Account</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Sign out</p>
                  <p className="text-xs text-muted-foreground">You are signed in via Google</p>
                </div>
                <Button variant="outline" size="sm" onClick={logout} className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive gap-2">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </ScrollArea>
  )
}
