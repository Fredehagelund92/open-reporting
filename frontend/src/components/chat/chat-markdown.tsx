import type React from "react"

/** Parse inline markdown: **bold**, *italic*, `code`, [links](url) */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/,
  )
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/)
    if (bold)
      return (
        <strong key={i} className="font-bold">
          {bold[1]}
        </strong>
      )

    const italic = part.match(/^\*([^*]+)\*$/)
    if (italic) return <em key={i}>{italic[1]}</em>

    const code = part.match(/^`([^`]+)`$/)
    if (code)
      return (
        <code
          key={i}
          className="px-1 py-px rounded bg-muted/80 border border-border/50 text-[11px]"
        >
          {code[1]}
        </code>
      )

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link)
      return (
        <a
          key={i}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {link[1]}
        </a>
      )

    return part
  })
}

export function ChatMarkdown({ text }: { text: string }) {
  if (!text) return null

  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      i++
      elements.push(
        <pre
          key={elements.length}
          className="my-1.5 rounded-md bg-muted/80 border border-border/50 px-2.5 py-2 overflow-x-auto"
        >
          <code className="text-[11px] leading-relaxed">
            {codeLines.join("\n")}
          </code>
        </pre>,
      )
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const sizes = ["text-[15px]", "text-[14px]", "text-[13px]"]
      elements.push(
        <div
          key={elements.length}
          className={`${sizes[level - 1]} font-bold mt-2 mb-0.5`}
        >
          {renderInline(headingMatch[2])}
        </div>,
      )
      i++
      continue
    }

    // Unordered list
    if (line.match(/^\s*[-*]\s+/)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
        items.push(
          <li key={items.length} className="ml-3 list-disc">
            {renderInline(lines[i].replace(/^\s*[-*]\s+/, ""))}
          </li>,
        )
        i++
      }
      elements.push(
        <ul key={elements.length} className="my-1 space-y-0.5">
          {items}
        </ul>,
      )
      continue
    }

    // Ordered list
    if (line.match(/^\s*\d+[.)]\s+/)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && lines[i].match(/^\s*\d+[.)]\s+/)) {
        items.push(
          <li key={items.length} className="ml-3 list-decimal">
            {renderInline(lines[i].replace(/^\s*\d+[.)]\s+/, ""))}
          </li>,
        )
        i++
      }
      elements.push(
        <ol key={elements.length} className="my-1 space-y-0.5">
          {items}
        </ol>,
      )
      continue
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={elements.length} className="h-1.5" />)
      i++
      continue
    }

    // Paragraph
    elements.push(
      <span key={elements.length} className="block">
        {renderInline(line)}
      </span>,
    )
    i++
  }

  return <>{elements}</>
}
