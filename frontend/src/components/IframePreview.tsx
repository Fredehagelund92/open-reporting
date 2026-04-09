import React, { useEffect, useRef } from "react"

interface IframePreviewProps {
  html: string
  className?: string
  style?: React.CSSProperties
  /**
   * Controls the iframe `sandbox` attribute.
   * Default `"allow-scripts"`: runs scripts in a null origin — outside the
   * parent page's CSP scope, so inline <script> blocks and onclick handlers
   * execute freely. The null origin also prevents access to parent
   * localStorage and cookies.
   * Pass a custom sandbox string to change the policy.
   */
  sandbox?: string
}

/**
 * Renders full HTML documents inside a sandboxed iframe using srcdoc.
 * Unlike Shadow DOM, this supports external fonts, scripts, and full
 * <!DOCTYPE> rendering — ideal for previewing pasted HTML reports.
 *
 * Security model (sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"):
 * - Null origin: parent localStorage, cookies, and credentialed API calls are blocked.
 * - allow-scripts: inline <script> blocks and onclick handlers execute. Null origin
 *   also means the parent page's CSP (script-src 'self') does NOT propagate, so
 *   inline scripts are unrestricted.
 * - allow-popups + allow-popups-to-escape-sandbox: <a target="_blank"> links work
 *   and open in a fresh, unsandboxed tab (standard for report links).
 * - NOT granted: allow-same-origin (would let scripts read parent localStorage),
 *   allow-top-navigation (would let scripts redirect the parent page),
 *   allow-forms (blocks form submissions to external servers).
 */
const DEFAULT_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox"

export default function IframePreview({ html, className = "", style, sandbox = DEFAULT_SANDBOX }: IframePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    // Using srcdoc directly via the attribute causes React to diff the
    // entire string on every render. Writing via the DOM avoids that and
    // also lets us handle the empty→content transition cleanly.
    iframe.srcdoc = html || ""
  }, [html])

  return (
    <iframe
      ref={iframeRef}
      sandbox={sandbox}
      className={className}
      style={{ width: "100%", height: "100%", border: "none", display: "block", ...style }}
      title="Report preview"
    />
  )
}
