import { useState, useEffect, useRef } from "react"
import { Copy, Check } from "lucide-react"
import { createHighlighter, type Highlighter } from "shiki"

/* ── Shared Shiki instance ─────────────────────────────────────────── */

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light"],
      langs: ["python", "bash", "json", "markdown", "html"],
    })
  }
  return highlighterPromise
}

/* ── CodeBlock ─────────────────────────────────────────────────────── */

export function CodeBlock({
  code,
  label,
  lang = "python",
}: {
  code: string
  label?: string
  lang?: "python" | "bash" | "json" | "markdown" | "html" | "plain"
}) {
  const [copied, setCopied] = useState(false)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (lang === "plain") return
    let cancelled = false
    getHighlighter().then((hl) => {
      if (cancelled) return
      const html = hl.codeToHtml(code, {
        lang,
        theme: "github-light",
      })
      setHighlighted(html)
    })
    return () => { cancelled = true }
  }, [code, lang])

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-2">
      {label && (
        <div className="text-xs text-muted-foreground mb-1 font-mono">
          {label}
        </div>
      )}
      <div
        ref={containerRef}
        className="code-block-surface rounded-sm pr-12 overflow-x-auto"
      >
        {highlighted ? (
          <div
            className="shiki-wrapper"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <pre className="px-4 py-3 font-mono text-sm whitespace-pre-wrap break-words overflow-hidden">
            <code>{code}</code>
          </pre>
        )}
      </div>
      <button
        onClick={copy}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="size-4 text-signal" />
        ) : (
          <Copy className="size-4" />
        )}
      </button>
    </div>
  )
}
