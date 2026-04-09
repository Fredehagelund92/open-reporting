import React from "react"

interface IframePreviewProps {
  html: string
  className?: string
  style?: React.CSSProperties
  /**
   * Controls the iframe `sandbox` attribute.
   * Default `"allow-scripts allow-popups allow-popups-to-escape-sandbox"`:
   * scripts execute in a null origin (can't access parent localStorage/cookies).
   * allow-popups lets <a target="_blank"> links open in new tabs.
   */
  sandbox?: string
}

/**
 * Renders full HTML documents inside a sandboxed iframe using srcdoc.
 *
 * Security model:
 * - sandbox="allow-scripts" (without allow-same-origin) → null origin →
 *   iframe cannot access parent localStorage, cookies, or credentialed APIs.
 * - The parent page's CSP (`script-src 'self' 'unsafe-inline'`) propagates to
 *   the srcdoc document, allowing inline <script> blocks and onclick handlers.
 *   This is safe because the sandbox's null-origin isolation prevents the
 *   iframe from accessing anything sensitive in the parent.
 */
const DEFAULT_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox"

export default function IframePreview({ html, className = "", style, sandbox = DEFAULT_SANDBOX }: IframePreviewProps) {
  return (
    <iframe
      srcDoc={html || ""}
      sandbox={sandbox}
      className={className}
      style={{ width: "100%", height: "100%", border: "none", display: "block", ...style }}
      title="Report preview"
    />
  )
}
