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

function parseSlides(sanitizedHtml: string): Slide[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${sanitizedHtml}</div>`, "text/html")
  const sections = Array.from(doc.querySelectorAll("section"))

  if (sections.length > 0) {
    return sections.map((section) => ({
      html: section.innerHTML.trim(),
      bgColor: section.getAttribute("data-background-color") || "#ffffff",
    }))
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
          "section",
          "canvas",
          "svg",
          "path",
          "circle",
          "rect",
          "line",
          "polyline",
          "polygon",
          "text",
          "g",
          "defs",
          "clippath",
          "use",
        ],
        ADD_ATTR: [
          "style",
          "viewbox",
          "fill",
          "stroke",
          "stroke-width",
          "d",
          "cx",
          "cy",
          "r",
          "x",
          "y",
          "x1",
          "x2",
          "y1",
          "y2",
          "points",
          "width",
          "height",
          "transform",
          "role",
          "aria-label",
          "xmlns",
          "preserveaspectratio",
        ],
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
            ? "border h-[100vh] rounded-none border-slate-700/30 bg-slate-900/10"
            : "bg-white dark:bg-slate-900 sm:rounded-xl sm:border sm:border-slate-200 sm:dark:border-slate-800 sm:shadow-xl sm:ring-1 sm:ring-slate-900/5 sm:dark:ring-slate-100/5 sm:p-3 md:p-4"
        }`}
      >
        <div className={`relative overflow-hidden ${isFullscreen ? "h-full" : "aspect-[4/3] sm:aspect-video rounded-none sm:rounded-lg sm:border sm:border-slate-200 sm:dark:border-slate-800 bg-slate-50 dark:bg-slate-950"}`}>
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
                  <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center p-3 sm:p-8 md:p-14 lg:p-16">
                    <div
                      className={[
                        "w-full",
                        isTitleSlide ? "text-center" : "",
                        isDarkSlide ? "text-slate-100" : "text-slate-800",
                        "[&_h1]:text-xl [&_h1]:sm:text-4xl [&_h1]:md:text-5xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:leading-tight [&_h1]:mb-2 [&_h1]:sm:mb-5",
                        "[&_h2]:text-lg [&_h2]:sm:text-3xl [&_h2]:md:text-4xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:leading-tight [&_h2]:mb-2 [&_h2]:sm:mb-4",
                        "[&_h3]:text-base [&_h3]:sm:text-xl [&_h3]:md:text-2xl [&_h3]:font-semibold [&_h3]:mb-1.5 [&_h3]:sm:mb-3",
                        "[&_p]:text-xs [&_p]:sm:text-base [&_p]:md:text-lg [&_p]:leading-relaxed",
                        "[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:sm:pl-6 [&_ul]:my-1.5 [&_ul]:sm:my-3 [&_ul]:text-xs [&_ul]:sm:text-base [&_ul]:md:text-lg [&_ul]:leading-relaxed",
                        "[&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:sm:pl-6 [&_ol]:my-1.5 [&_ol]:sm:my-3 [&_ol]:text-xs [&_ol]:sm:text-base [&_ol]:md:text-lg [&_ol]:leading-relaxed",
                        "[&_table]:text-xs [&_table]:sm:text-sm [&_table]:md:text-base",
                        isDarkSlide
                          ? "[&_h1]:text-white [&_h2]:text-white [&_h3]:text-slate-100 [&_p]:text-slate-200 [&_li]:text-slate-200"
                          : "[&_h1]:text-slate-900 [&_h2]:text-slate-900 [&_h3]:text-slate-800 [&_p]:text-slate-700 [&_li]:text-slate-700",
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
                      : "bg-white/95 text-slate-700"
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
                      : "bg-white/95 text-slate-700"
                  }`}
                  onClick={next}
                  disabled={currentIndex === totalSlides - 1}
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>

              <div className="absolute left-1/2 bottom-4 -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-medium text-white">
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
            <div className="rounded-full bg-slate-100/90 dark:bg-slate-800/90 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                {slides.map((_, index) => (
                  <button
                    key={`dot-${index}`}
                    type="button"
                    className={`h-2.5 w-2.5 rounded-full transition-all ${
                      index === currentIndex ? "bg-amber-500 scale-110" : "bg-slate-300 hover:bg-slate-400"
                    }`}
                    onClick={() => goTo(index)}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            <span className={`hidden sm:inline ${isFullscreen ? "text-slate-300" : "text-slate-500 dark:text-slate-400"} text-xs`}>
              Use arrow keys to browse slides
            </span>
            <span className={`inline sm:hidden ${isFullscreen ? "text-slate-300" : "text-slate-500 dark:text-slate-400"} text-xs`}>
              Swipe to navigate
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
