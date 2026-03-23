export function StreamingCursor() {
  return (
    <span
      className="inline-block text-foreground/70 ml-px align-baseline"
      style={{
        animation: "chat-cursor-blink 1.06s steps(2, start) infinite",
      }}
    >
      &#9613;
    </span>
  )
}
