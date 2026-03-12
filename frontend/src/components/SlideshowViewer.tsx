/**
 * SlideshowViewer — renders Reveal.js slides from HTML sections.
 *
 * Expects `html_body` containing <section> elements.
 * Each <section> becomes one slide.
 */

import { useEffect, useRef, useState } from "react"
import DOMPurify from "dompurify"
import Reveal from "reveal.js"
import "reveal.js/dist/reveal.css"
import "reveal.js/dist/theme/white.css"

interface SlideshowViewerProps {
  htmlBody: string
  isFullscreen?: boolean
}

export function SlideshowViewer({ htmlBody, isFullscreen = false }: SlideshowViewerProps) {
  const deckRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<Reveal.Api | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [totalSlides, setTotalSlides] = useState(0)
  const [isReady, setIsReady] = useState(false)

  // Sanitize the HTML (allow <section> tags for slides)
  const sanitizedHtml = DOMPurify.sanitize(htmlBody, {
    ADD_TAGS: ["section", "canvas"],
    ADD_ATTR: ["style", "data-transition", "data-background-color", "data-auto-animate"],
    ALLOW_DATA_ATTR: true,
  })

  useEffect(() => {
    if (!deckRef.current) return

    setIsReady(false)

    const timer = setTimeout(() => {
      if (revealRef.current) {
        revealRef.current.destroy()
      }

      const deck = new Reveal(deckRef.current!, {
        embedded: !isFullscreen,
        hash: false,
        controls: true,
        controlsTutorial: false,
        progress: true,
        center: true,
        transition: "slide",
        width: isFullscreen ? "100%" : 960,
        height: isFullscreen ? "100%" : 700,
        margin: isFullscreen ? 0.04 : 0.1,
        minScale: 0.2,
        maxScale: 1.5,
        // Prevent Reveal from auto-enabling scroll-view on narrow embedded layouts.
        // (Reveal's scroll-view controller can crash in embedded mode when activated.)
        scrollActivationWidth: 0,
        // Keyboard navigation
        keyboard: true,
        // Don't show slide numbers (we have our own)
        slideNumber: false,
      })

      deck.initialize().then(() => {
        revealRef.current = deck
        setTotalSlides(deck.getTotalSlides())
        setCurrentSlide(deck.getState().indexh + 1)
        setIsReady(true)

        deck.on("slidechanged", (event: any) => {
          setCurrentSlide(event.indexh + 1)
        })
      })
    }, 100)

    return () => {
      clearTimeout(timer)
      if (revealRef.current) {
        revealRef.current.destroy()
        revealRef.current = null
      }
    }
  }, [sanitizedHtml, isFullscreen])

  return (
    <div className="slideshow-viewer relative">
      {/* Reveal.js container */}
      <div
        ref={deckRef}
        className="reveal"
        style={{
          width: "100%",
          height: isFullscreen ? "100vh" : "600px",
          borderRadius: isFullscreen ? 0 : "12px",
          overflow: "hidden",
          opacity: isReady ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      >
        <div
          className="slides"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>

      {/* Slide counter */}
      {totalSlides > 0 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm text-slate-500">
          <span className="font-medium">
            Slide {currentSlide} of {totalSlides}
          </span>
          <span className="text-xs text-slate-400">
            ← → to navigate • F for fullscreen
          </span>
        </div>
      )}
    </div>
  )
}
