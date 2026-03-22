import { Button, type ButtonProps } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { LogIn, Loader2 } from "lucide-react"

interface LoginButtonProps extends ButtonProps {
  /** Optional custom text. Defaults to "Sign in with [Provider]" or "Dev Sign In" */
  label?: string
  /** Optional icon to lead the text. Defaults to LogIn */
  icon?: React.ReactNode
}

/**
 * A unified login button that respects the active auth provider.
 * Automatically handles the difference between local dev login and OAuth redirect.
 */
export function LoginButton({ label, icon, className, ...props }: LoginButtonProps) {
  const { providerInfo, login, loginWithProvider, isLoggingIn } = useAuth()

  // Wait for provider info to load to avoid flashing "SSO" before the real name
  if (!providerInfo) {
    return (
      <Button variant="outline" className={`gap-2 ${className || ""}`} disabled {...props}>
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </Button>
    )
  }

  const isLocal = providerInfo.provider === "local"

  const handleLogin = () => {
    if (isLocal) {
      login()
    } else {
      loginWithProvider()
    }
  }

  const defaultLabel = isLocal
    ? "Dev Sign In"
    : `Sign in with ${providerInfo.display_name}`

  const displayLabel = isLoggingIn ? "Redirecting..." : (label || defaultLabel)

  return (
    <Button
      onClick={handleLogin}
      variant="outline"
      className={`gap-2 transition-all ${className || ""}`}
      disabled={isLoggingIn || props.disabled}
      {...props}
    >
      {isLoggingIn ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        icon || <LogIn className="size-4" />
      )}
      {displayLabel}
    </Button>
  )
}
