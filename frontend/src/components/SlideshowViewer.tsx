/**
 * SlideshowViewer — renders slideshow HTML as native app slides.
 *
 * Expects `html_body` containing <section> elements.
 * Each <section> becomes one slide.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import DOMPurify from "dompurify"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SlideshowViewerProps {
  htmlBody: string
  isFullscreen?: boolean
  onRequestExitFullscreen?: () => void
}

interface Slide {
  html: string
  bgColor: string
}

/** Light hex colours whose backgrounds should become translucent on dark slides. */
const LIGHT_BG_VALUES = new Set([
  "#ffffff", "#fff", "#f8fafc", "#f1f5f9",
  "rgb(255, 255, 255)", "rgb(248, 250, 252)", "rgb(241, 245, 249)",
])

/**
 * Adapt inline styles for dark-background slides so CSS overrides take effect.
 *
 * The backend renderer hard-codes colours designed for light backgrounds
 * (e.g. `color:#0f172a`, `background:#ffffff`). On a dark slide these are
 * invisible or jarring. We strip inline `color` and convert white/light
 * backgrounds to semi-transparent so the Tailwind dark-slide classes
 * (`!text-white`, `!text-slate-200`, …) can take over naturally.
 */
function adaptForDarkSlide(html: string): string {
  const tmp = document.createElement("div")
  tmp.innerHTML = html

  tmp.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    // Strip inline text colour → lets CSS dark-slide overrides cascade
    el.style.removeProperty("color")

    // Convert white / near-white backgrounds to translucent
    const bg = (el.style.backgroundColor || el.style.background || "").toLowerCase().replace(/\s/g, "")
    if (bg && LIGHT_BG_VALUES.has(bg)) {
      el.style.background = "rgba(255,255,255,0.08)"
      el.style.removeProperty("background-color")
    }

    // Soften borders for dark context
    if (el.style.borderColor) {
      el.style.borderColor = "rgba(255,255,255,0.15)"
    }
    if (el.style.borderBottomColor || el.style.borderBottom) {
      el.style.borderBottomColor = "rgba(255,255,255,0.25)"
    }
    if (el.style.border) {
      el.style.borderColor = "rgba(255,255,255,0.15)"
    }
  })

  return tmp.innerHTML
}

function parseSlides(sanitizedHtml: string): Slide[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${sanitizedHtml}</div>`, "text/html")
  const sections = Array.from(doc.querySelectorAll("section"))

  if (sections.length > 0) {
    return sections.map((section) => {
      const bgColor = section.getAttribute("data-background-color") || "#ffffff"
      let html = section.innerHTML.trim()
      if (isDarkBackground(bgColor)) {
        html = adaptForDarkSlide(html)
      }
      return { html, bgColor }
    })
  }

  return [{ html: sanitizedHtml, bgColor: "#ffffff" }]
}

function normalizeHexColor(color: string): string | null {
  const value = color.trim().toLowerCase()

  if (!value.startsWith("#")) return null
  if (value.length === 4) {
    const r = value[1]
    const g = value[2]
    const b = value[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (value.length === 7) return value

  return null
}

function isDarkBackground(color: string): boolean {
  const normalized = normalizeHexColor(color)
  if (!normalized) return false

  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000

  return yiq < 145
}

export function SlideshowViewer({
  htmlBody,
  isFullscreen = false,
  onRequestExitFullscreen,
}: SlideshowViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  const sanitizedHtml = useMemo(
    () =>
      DOMPurify.sanitize(htmlBody, {
        ADD_TAGS: [
          "section", "canvas", "svg", "path", "circle", "rect", "line",
          "polyline", "polygon", "text", "g", "defs", "clippath", "use",
        ],
        ADD_ATTR: [
          "style", "viewbox", "fill", "stroke", "stroke-width", "d",
          "cx", "cy", "r", "x", "y", "x1", "x2", "y1", "y2", "points",
          "width", "height", "transform", "role", "aria-label", "xmlns",
          "preserveaspectratio", "stroke-dasharray", "dominant-baseline",
          "text-anchor", "fill-opacity", "rx",
        ],
        FORBID_TAGS: [
          "script", "style", "iframe", "form", "input", "textarea", "select",
          "button", "embed", "object", "applet", "meta", "base", "link",
        ],
        FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
        ALLOW_DATA_ATTR: true,
        RETURN_TRUSTED_TYPE: false,
      }) as string,
    [htmlBody],
  )

  const slides = useMemo(() => parseSlides(sanitizedHtml), [sanitizedHtml])
  const totalSlides = slides.length
  const hasMultipleSlides = totalSlides > 1
  const currentSlide = slides[currentIndex]
  const isCurrentSlideDark = currentSlide ? isDarkBackground(currentSlide.bgColor) : false

  // Reset index when content changes
  const [prevHtml, setPrevHtml] = useState(sanitizedHtml)
  if (prevHtml !== sanitizedHtml) {
    setPrevHtml(sanitizedHtml)
    setCurrentIndex(0)
  }

  const goTo = useCallback(
    (nextIndex: number) => {
      if (!hasMultipleSlides) return
      const bounded = Math.max(0, Math.min(nextIndex, totalSlides - 1))
      setCurrentIndex(bounded)
    },
    [hasMultipleSlides, totalSlides],
  )

  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo])
  const prev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX === null) return
    const delta = touchStartX - e.changedTouches[0].clientX
    if (Math.abs(delta) > 50) {
      if (delta > 0) next()
      else prev()
    }
    setTouchStartX(null)
  }, [touchStartX, next, prev])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault()
        next()
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        prev()
      } else if (event.key === "Escape" && isFullscreen && onRequestExitFullscreen) {
        event.preventDefault()
        onRequestExitFullscreen()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isFullscreen, next, onRequestExitFullscreen, prev])

  return (
    <div className="slideshow-viewer w-full">
      <div
        className={`relative overflow-hidden ${
          isFullscreen
            ? "border h-[100vh] rounded-none border-border/30 bg-muted/10"
            : "bg-background sm:rounded-xl sm:border sm:border-border sm:shadow-xl sm:ring-1 sm:ring-foreground/5 sm:p-3 md:p-4"
        }`}
      >
        <div className={`relative overflow-hidden ${isFullscreen ? "h-full" : "aspect-[4/3] sm:aspect-video rounded-none sm:rounded-lg sm:border sm:border-border bg-muted"}`}>
          <div
            className="flex h-full transition-transform duration-400 ease-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {slides.map((slide, index) => {
              const isDarkSlide = isDarkBackground(slide.bgColor)
              const isTitleSlide = index === 0

              return (
                <article
                  key={`slide-${index}`}
                  className="h-full w-full shrink-0 overflow-y-auto"
                  style={{ backgroundColor: slide.bgColor }}
                >
                  <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-start p-3 sm:p-8 md:p-14 lg:p-16">
                    <div
                      className={[
                        "w-full",
                        isTitleSlide ? "text-center" : "",
                        isDarkSlide ? "text-slate-100" : "text-foreground",
                        "[&_h1]:!text-xl [&_h1]:sm:!text-4xl [&_h1]:md:!text-5xl [&_h1]:!font-bold [&_h1]:!tracking-tight [&_h1]:!leading-tight [&_h1]:!mb-2 [&_h1]:sm:!mb-5",
                        "[&_h2]:!text-lg [&_h2]:sm:!text-3xl [&_h2]:md:!text-4xl [&_h2]:!font-semibold [&_h2]:!tracking-tight [&_h2]:!leading-tight [&_h2]:!mb-2 [&_h2]:sm:!mb-4",
                        "[&_h3]:!text-lg [&_h3]:sm:!text-xl [&_h3]:md:!text-2xl [&_h3]:!font-semibold [&_h3]:!mb-1.5 [&_h3]:sm:!mb-3",
                        "[&_p]:!text-sm [&_p]:sm:!text-base [&_p]:md:!text-lg [&_p]:!leading-relaxed",
                        "[&_ul]:!list-disc [&_ul]:!pl-4 [&_ul]:sm:!pl-6 [&_ul]:!my-1.5 [&_ul]:sm:!my-3 [&_ul]:!text-sm [&_ul]:sm:!text-base [&_ul]:md:!text-lg [&_ul]:!leading-relaxed",
                        "[&_ol]:!list-decimal [&_ol]:!pl-4 [&_ol]:sm:!pl-6 [&_ol]:!my-1.5 [&_ol]:sm:!my-3 [&_ol]:!text-sm [&_ol]:sm:!text-base [&_ol]:md:!text-lg [&_ol]:!leading-relaxed",
                        "[&_table]:!text-xs [&_table]:sm:!text-sm [&_table]:md:!text-base",
                        "[&_svg]:w-full [&_svg]:max-w-full [&_svg]:h-auto",
                        isDarkSlide
                          ? "[&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-slate-100 [&_p]:!text-slate-200 [&_li]:!text-slate-200 [&_span]:!text-slate-200 [&_strong]:!text-white [&_b]:!text-white [&_td]:!text-slate-200 [&_th]:!text-slate-300"
                          : "[&_h1]:!text-slate-900 [&_h2]:!text-slate-900 [&_h3]:!text-slate-800 [&_p]:!text-slate-700 [&_li]:!text-slate-700",
                      ].join(" ")}
                      dangerouslySetInnerHTML={{ __html: slide.html }}
                    />
                  </div>
                </article>
              )
            })}
          </div>

          {hasMultipleSlides && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 md:px-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={`pointer-events-auto rounded-full shadow ${
                    isCurrentSlideDark
                      ? "border-slate-100/30 bg-slate-900/45 text-white hover:bg-slate-900/60 hover:text-white"
                      : "bg-white/95 text-muted-foreground"
                  }`}
                  onClick={prev}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={`pointer-events-auto rounded-full shadow ${
                    isCurrentSlideDark
                      ? "border-slate-100/30 bg-slate-900/45 text-white hover:bg-slate-900/60 hover:text-white"
                      : "bg-white/95 text-muted-foreground"
                  }`}
                  onClick={next}
                  disabled={currentIndex === totalSlides - 1}
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>

              <div className="absolute left-1/2 bottom-4 -translate-x-1/2 rounded-full bg-foreground/80 px-3 py-1 text-xs font-medium text-background">
                {currentIndex + 1} / {totalSlides}
              </div>
            </>
          )}
        </div>

        {hasMultipleSlides && (
          <div
            className={`mt-3 flex flex-wrap items-center justify-center gap-3 ${
              isFullscreen ? "absolute left-0 right-0 bottom-0 z-20 pb-4" : ""
            }`}
          >
            <div className="rounded-full bg-muted/90 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                {slides.map((_, index) => (
                  <button
                    key={`dot-${index}`}
                    type="button"
                    className={`h-2.5 w-2.5 rounded-full transition-all ${
                      index === currentIndex ? "bg-primary scale-110" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    onClick={() => goTo(index)}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            <span className="hidden sm:inline text-muted-foreground text-xs">
              Use arrow keys to browse slides
            </span>
            <span className="inline sm:hidden text-muted-foreground text-xs">
              Swipe to navigate
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
