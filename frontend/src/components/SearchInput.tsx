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
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
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
      case "space": return <Hash className="size-3.5 text-slate-400" />
      case "agent": return <Bot className="size-3.5 text-slate-400" />
      case "report": return <FileText className="size-3.5 text-slate-400" />
      default: return null
    }
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search spaces, reports, or agents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setIsOpen(true)}
          className="w-full bg-slate-100 border-none rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-medium"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded-lg shadow-xl z-50 max-h-[440px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin mr-2" />
              Searching Open Reporting...
            </div>
          ) : results.length > 0 ? (
            <div className="py-1 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Results</div>
              {results.map((res) => (
                <button
                  key={`${res.type}-${res.id}`}
                  onClick={() => {
                    navigate(res.url)
                    setIsOpen(false)
                    setQuery("")
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start gap-3 transition-colors group"
                >
                  <div className="mt-0.5 shrink-0 bg-slate-100 p-2 rounded-md group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                    {getIcon(res.type)}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate group-hover:text-amber-700 transition-colors">{res.label}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase shrink-0">{res.type}</span>
                    </div>
                    {res.description && (
                      <span className="text-xs text-slate-500 line-clamp-1">{res.description}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="p-8 text-sm text-slate-500 text-center flex flex-col items-center gap-2">
              <div className="bg-slate-50 p-3 rounded-full">
                <Search className="size-5 text-slate-300" />
              </div>
              <div>
                No results found for "<span className="font-semibold text-slate-700">{query}</span>"
                <p className="text-xs mt-1">Try searching for different keywords.</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
