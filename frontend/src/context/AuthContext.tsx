/**
 * AuthContext — manages user session state.
 *
 * In production, this will be backed by a real Google Workspace OAuth2 flow.
 * For now, it uses mock data to demonstrate the UI flow.
 *
 * The Provider pattern here is designed for extensibility:
 * swap `mockLogin()` with a real `googleLogin()` or `oktaLogin()` later.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { api } from "@/lib/api"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  avatar: string
  joinedAt: string
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  
  // Verify token on load
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      api.get("/auth/me")
        .then(res => {
          // Map backend UserProfile to AuthUser expected by frontend
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
      
      // Fetch user profile
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

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
