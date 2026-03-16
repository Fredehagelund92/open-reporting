import { createContext, useContext } from "react"
import type { AuthUser, AuthProviderInfo } from "@/types"

export interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  providerInfo: AuthProviderInfo | null
  isLoggingIn: boolean
  login: (email: string) => Promise<void>
  loginWithProvider: (providerId: string) => void
  logout: () => void
  refreshUser: () => Promise<void>
  setUserFromToken: (token: string) => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
