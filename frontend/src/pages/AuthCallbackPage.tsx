/**
 * AuthCallbackPage — handles the OAuth redirect from the backend.
 *
 * After the backend exchanges the OAuth code for a JWT, it redirects here
 * with ?token=xxx. This page stores the token and redirects to /.
 */

import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUserFromToken } = useAuth()

  useEffect(() => {
    const token = searchParams.get("token")
    const refreshToken = searchParams.get("refresh_token")
    if (token) {
      localStorage.setItem("token", token)
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken)
      }
      // Fetch the user profile and update context
      setUserFromToken(token)
      navigate("/", { replace: true })
    } else {
      // No token — something went wrong, redirect home
      navigate("/", { replace: true })
    }
  }, [searchParams, navigate, setUserFromToken])

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  )
}
