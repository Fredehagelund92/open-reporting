/**
 * AuthContext — manages user session state.
 *
 * Supports multiple auth modes via the backend's /auth/providers endpoint:
 * - "local":  email/password login (for dev / self-hosted)
 * - "google": Google Workspace OAuth redirect
 * - future:   any provider the backend registers
 *
 * All providers converge to a JWT stored in localStorage.
 */

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { api } from "@/lib/api"
import type { AuthUser, AuthProviderInfo } from "@/types"
import { AuthContext, useAuth } from "@/hooks/use-auth"

// eslint-disable-next-line react-refresh/only-export-components
export { useAuth }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [providerInfo, setProviderInfo] = useState<AuthProviderInfo | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Fetch which auth provider is active
  useEffect(() => {
    api.get<AuthProviderInfo>("/auth/providers")
      .then((res) => setProviderInfo(res.data))
      .catch(() => setProviderInfo({ provider: "local", display_name: "Email & Password" }))
  }, [])
  
  // Verify token on load
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      api.get("/auth/me")
        .then((res) => {
          const data = res.data
          setUser({
            ...data,
            avatar: data.avatar_url || "",
            joinedAt: data.created_at,
            provider: data.provider || "local",
            is_active: data.is_active ?? true
          })
        })
        .catch(() => {
          localStorage.removeItem("token")
          setUser(null)
        })
    }
  }, [])

  /** Hydrate user after OAuth callback sets token. */
  const setUserFromToken = useCallback(async (token: string) => {
    localStorage.setItem("token", token)
    try {
      const res = await api.get("/auth/me")
      setUser({
        ...res.data,
        avatar: res.data.avatar_url || "",
        joinedAt: res.data.created_at,
        provider: res.data.provider || "local",
        is_active: res.data.is_active ?? true
      })
      window.dispatchEvent(new CustomEvent("refresh-sidebar"))
    } catch {
      localStorage.removeItem("token")
      setUser(null)
    }
  }, [])

  /** Local email/password login (dev mode). */
  const login = async () => {
    try {
      const params = new URLSearchParams()
      params.append("username", "admin@company.com")
      params.append("password", "password")
      
      const res = await api.post("/auth/token", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      })
      
      const token = res.data.access_token
      localStorage.setItem("token", token)
      
      const meRes = await api.get("/auth/me")
      setUser({
        ...meRes.data,
        avatar: meRes.data.avatar_url || "",
        joinedAt: meRes.data.created_at,
        is_active: meRes.data.is_active ?? true
      })
      window.dispatchEvent(new CustomEvent("refresh-sidebar"))
    } catch (err) {
      console.error("Login failed:", err)
    }
  }

  /** OAuth redirect login — sends user to the backend OAuth endpoint. */
  const loginWithProvider = useCallback(() => {
    if (!providerInfo || providerInfo.provider === "local") return
    setIsLoggingIn(true)
    // Full-page redirect to backend OAuth login
    const backendUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
    window.location.href = `${backendUrl}/api/v1/auth/${providerInfo.provider}/login`
  }, [providerInfo])

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
  }

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me")
      setUser({
        ...res.data,
        avatar: res.data.avatar_url || "",
        joinedAt: res.data.created_at,
        provider: res.data.provider || "local",
        is_active: res.data.is_active ?? true
      })
    } catch (err) {
      console.error("Failed to refresh user:", err)
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      providerInfo,
      isLoggingIn,
      login,
      loginWithProvider,
      logout,
      refreshUser,
      setUserFromToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
