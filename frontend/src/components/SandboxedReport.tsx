import { useEffect, useRef } from 'react'

interface SandboxedReportProps {
  htmlBody: string
  className?: string
}

export default function SandboxedReport({ htmlBody, className = '' }: SandboxedReportProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let shadow = host.shadowRoot
    if (!shadow) {
      shadow = host.attachShadow({ mode: 'open' })
    }

    shadow.innerHTML = prepareHtml(htmlBody)

    // Match host background to the report's background so there's no
    // gray gap when the report content doesn't fill the container
    const wrapper = shadow.querySelector('.sr-body') as HTMLElement | null
    if (wrapper) {
      const bg = getComputedStyle(wrapper).backgroundColor
      host.style.backgroundColor = bg || ''
    } else {
      host.style.backgroundColor = '#fff'
    }
  }, [htmlBody])

  return <div ref={hostRef} className={className} />
}

function prepareHtml(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''

  const isFullDoc = /<!doctype|<html/i.test(trimmed)
  if (!isFullDoc) {
    return `<div class="sr-body" style="background:#fff">${trimmed}</div>`
  }

  // Extract styles from <head>
  const headMatch = trimmed.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const headContent = headMatch?.[1] ?? ''
  const styleTags = headContent.match(/<style[\s\S]*?<\/style>|<link[^>]*rel=["']stylesheet["'][^>]*>/gi) ?? []

  // Shadow DOM has no <body> or <html> element. Rewrite selectors:
  // - `html` → `:host` (the shadow host element, for box-model / overflow)
  // - `body` → `.sr-body` (a wrapper div inside the shadow, for padding / color / font)
  const rewrittenStyles = styleTags.map(tag =>
    tag
      .replace(/\bhtml\b/g, ':host')
      .replace(/\bbody\b/g, '.sr-body')
  ).join('\n')

  // Extract body content
  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyContent = bodyMatch?.[1] ?? trimmed

  // Extract body class and style attributes if present
  const bodyTag = trimmed.match(/<body([^>]*)>/i)?.[1] ?? ''
  const bodyClass = bodyTag.match(/class=["']([^"']*)["']/i)?.[1] ?? ''
  const bodyStyle = bodyTag.match(/style=["']([^"']*)["']/i)?.[1] ?? ''

  const classes = ['sr-body', bodyClass].filter(Boolean).join(' ')
  const styleAttr = bodyStyle ? ` style="${bodyStyle}"` : ''

  return `${rewrittenStyles}<div class="${classes}"${styleAttr}>${bodyContent}</div>`
}
