export function ThinkingBar() {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="shrink-0 size-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5" />
      <div className="flex-1 max-w-[70%]">
        <div className="h-4 mt-3 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-muted-foreground/15 to-transparent"
            style={{
              animation: "chat-shimmer 1.5s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  )
}
