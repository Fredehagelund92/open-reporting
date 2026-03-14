import { useState, useEffect, useRef } from "react"
import { Search, Loader2, Hash, Bot, FileText } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"

interface SearchResult {
  id: string
  type: "report" | "space" | "agent"
  label: string
  description?: string
  url: string
}

export function SearchInput() {
  const RECENT_KEY = "open-reporting:recent-searches"
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const navigate = useNavigate()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((v) => typeof v === "string"))
        }
      }
    } catch {
      // no-op for malformed local storage
    }
  }, [])

  const saveRecentSearch = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const next = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6)
    setRecentSearches(next)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }

  const handleSearch = async (val: string) => {
    if (!val.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    setIsOpen(true)
    try {
      // API call to the FastAPI backend
      const resp = await api.get(`/search/?q=${encodeURIComponent(val)}`)
      setResults(resp.data.results)
    } catch (err) {
      console.error("Search failed:", err)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  // Debounce search requests
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    if (query.trim()) {
      timeoutRef.current = setTimeout(() => {
        handleSearch(query)
      }, 300)
    } else {
      setResults([])
      setIsOpen(false)
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [query])

  const getIcon = (type: string) => {
    switch (type) {
      case "space": return <Hash className="size-3.5 text-muted-foreground" />
      case "agent": return <Bot className="size-3.5 text-muted-foreground" />
      case "report": return <FileText className="size-3.5 text-muted-foreground" />
      default: return null
    }
  }

  const groupedResults = {
    report: results.filter((r) => r.type === "report"),
    space: results.filter((r) => r.type === "space"),
    agent: results.filter((r) => r.type === "agent"),
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search spaces, reports, or AI assistants..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full bg-muted border-none rounded-sm pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-popover border border-border rounded-sm shadow-xl z-50 max-h-[440px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              Searching Open Reporting...
            </div>
          ) : !query.trim() && recentSearches.length > 0 ? (
            <div className="py-1 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Recent Searches</span>
                <button
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setRecentSearches([])
                    localStorage.removeItem(RECENT_KEY)
                  }}
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setQuery(term)
                    handleSearch(term)
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors text-sm text-foreground"
                >
                  {term}
                </button>
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="py-1 overflow-y-auto">
              {(["report", "space", "agent"] as const).map((type) =>
                groupedResults[type].length > 0 ? (
                  <div key={type}>
                    <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
                      {type === "report" ? "Reports" : type === "space" ? "Spaces" : "AI Assistants"}
                    </div>
                    {groupedResults[type].map((res) => (
                      <button
                        key={`${res.type}-${res.id}`}
                        onClick={() => {
                          saveRecentSearch(query)
                          navigate(res.url)
                          setIsOpen(false)
                          setQuery("")
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-start gap-3 transition-colors group"
                      >
                        <div className="mt-0.5 shrink-0 bg-muted p-2 rounded-sm group-hover:bg-primary/15 group-hover:text-primary transition-colors">
                          {getIcon(res.type)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{res.label}</span>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground uppercase shrink-0">{res.type}</span>
                          </div>
                          {res.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1">{res.description}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null
              )}
            </div>
          ) : query.trim() ? (
            <div className="p-8 text-sm text-muted-foreground text-center flex flex-col items-center gap-2">
              <div className="bg-muted p-3 rounded-full">
                <Search className="size-5 text-muted-foreground/50" />
              </div>
              <div>
                No results found for "<span className="font-semibold text-foreground">{query}</span>"
                <p className="text-xs mt-1">Try searching for different keywords.</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
