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

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { api } from "@/lib/api"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  avatar: string
  joinedAt: string
}

export interface AuthProviderInfo {
  provider: string       // "local" | "google" | ...
  display_name: string   // "Email & Password" | "Google Workspace" | ...
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  providerInfo: AuthProviderInfo | null
  isLoggingIn: boolean

  /** Local dev login (email/password). Only works when provider is "local". */
  login: () => void

  /** OAuth login — redirects to the backend's OAuth login endpoint. */
  loginWithProvider: () => void

  logout: () => void

  /** Called by AuthCallbackPage to hydrate the user from a fresh JWT. */
  setUserFromToken: (token: string) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  providerInfo: null,
  isLoggingIn: false,
  login: () => {},
  loginWithProvider: () => {},
  logout: () => {},
  setUserFromToken: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [providerInfo, setProviderInfo] = useState<AuthProviderInfo | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Fetch which auth provider is active
  useEffect(() => {
    api.get("/auth/providers")
      .then((res: any) => setProviderInfo(res.data))
      .catch(() => setProviderInfo({ provider: "local", display_name: "Email & Password" }))
  }, [])
  
  // Verify token on load
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      api.get("/auth/me")
        .then((res: any) => {
          setUser({
            ...res.data,
            avatar: res.data.avatar_url || "",
            joinedAt: res.data.created_at
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
        joinedAt: res.data.created_at
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
        joinedAt: meRes.data.created_at
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

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      providerInfo,
      isLoggingIn,
      login,
      loginWithProvider,
      logout,
      setUserFromToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
