import React, { useCallback, useMemo, useRef, useState } from "react"

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
  /**
   * When true, the iframe expands to match its content height (no inner
   * scrollbar). The page scrollbar handles everything. Great for report
   * viewer pages. When false (default), the iframe fills its container
   * via height:100% — good for panels like the Create Report preview.
   */
  autoHeight?: boolean
}

const DEFAULT_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox"

/**
 * Small script injected at the end of the HTML when autoHeight is enabled.
 * It posts the document height to the parent on load and whenever the
 * content resizes (e.g. collapsible sections opening/closing).
 */
const AUTO_HEIGHT_SCRIPT = `<script>
(function(){
  function send(){
    var h = document.documentElement.scrollHeight;
    parent.postMessage({type:'iframe-height',height:h},'*');
  }
  send();
  new ResizeObserver(send).observe(document.documentElement);
  window.addEventListener('load',send);
})();
</script>`

export default function IframePreview({
  html,
  className = "",
  style,
  sandbox = DEFAULT_SANDBOX,
  autoHeight = false,
}: IframePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [contentHeight, setContentHeight] = useState<number>(0)

  // Inject the height-reporting script when autoHeight is enabled.
  const finalHtml = useMemo(() => {
    if (!html) return ""
    if (!autoHeight) return html
    // Insert before </body> if present, otherwise append.
    const idx = html.lastIndexOf("</body>")
    if (idx !== -1) {
      return html.slice(0, idx) + AUTO_HEIGHT_SCRIPT + html.slice(idx)
    }
    return html + AUTO_HEIGHT_SCRIPT
  }, [html, autoHeight])

  // Listen for height messages from the iframe.
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (e.data?.type === "iframe-height" && typeof e.data.height === "number") {
        // Only accept messages from our iframe.
        if (iframeRef.current && e.source === iframeRef.current.contentWindow) {
          setContentHeight(e.data.height)
        }
      }
    },
    [],
  )

  // Attach/detach the message listener.
  React.useEffect(() => {
    if (!autoHeight) return
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [autoHeight, handleMessage])

  const heightStyle: React.CSSProperties = autoHeight
    ? { width: "100%", height: contentHeight > 0 ? contentHeight : undefined, border: "none", display: "block", ...style }
    : { width: "100%", height: "100%", border: "none", display: "block", ...style }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={finalHtml}
      sandbox={sandbox}
      className={className}
      style={heightStyle}
      title="Report preview"
    />
  )
}
