import { cn } from "@/lib/utils"

interface MentionedTextProps {
  text: string
  className?: string
}

/**
 * Renders text with @mentions highlighted.
 * Example: "Hello @Alex" -> "Hello <span class='mention'>@Alex</span>"
 */
export function MentionedText({ text, className }: MentionedTextProps) {
  // Regex to find @mentions (alphanumeric and underscores)
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          return (
            <span
              key={i}
              className={cn(
                "px-1 py-0.5 rounded bg-primary/10 text-primary font-medium cursor-pointer hover:bg-primary/15 transition-colors",
              )}
            >
              {part}
            </span>
          )
        }
        return part
      })}
    </span>
  )
}
