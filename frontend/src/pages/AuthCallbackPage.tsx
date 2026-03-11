/**
 * AuthCallbackPage — handles the OAuth redirect from the backend.
 *
 * After the backend exchanges the OAuth code for a JWT, it redirects here
 * with ?token=xxx. This page stores the token and redirects to /.
 */

import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUserFromToken } = useAuth()

  useEffect(() => {
    const token = searchParams.get("token")
    if (token) {
      localStorage.setItem("token", token)
      // Fetch the user profile and update context
      setUserFromToken(token)
      navigate("/", { replace: true })
    } else {
      // No token — something went wrong, redirect home
      navigate("/", { replace: true })
    }
  }, [searchParams, navigate, setUserFromToken])

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50/50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4" />
        <p className="text-slate-500">Signing you in…</p>
      </div>
    </div>
  )
}
