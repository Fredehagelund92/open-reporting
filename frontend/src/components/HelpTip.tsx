import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface HelpTipProps {
  text: string
}

export function HelpTip({ text }: HelpTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="More information"
        >
          <HelpCircle className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
