/**
 * Report Builder Reference — catalog of section types, chart types,
 * themes, and layouts. One API call renders all previews.
 */

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Type,
  BarChart3,
  Palette,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Table2,
  AlertTriangle,
  Quote,
  Star,
  Columns2,
  Clock,
  CheckSquare,
  Minus,
  MoveVertical,
  PieChart,
  TrendingUp,
  Activity,
  Grid3X3,
  Sparkles,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import DOMPurify from "dompurify"

// ─── Types ───────────────────────────────────────────────────────

interface ExampleDef {
  id: string
  name: string
  description: string
  icon: React.ElementType
  sections: Record<string, unknown>[]
}

// ─── Section examples (metadata only — rendering is server-side) ─

const SECTION_EXAMPLES: ExampleDef[] = [
  { id: "summary-header", name: "Summary Header", description: "Large title with optional subtitle, date, and stat badges.", icon: FileText, sections: [{ type: "summary-header", title: "Weekly Business Review", subtitle: "Week of March 24 – March 30, 2025", date: "2025-03-30", stats: [{ label: "Revenue", value: "$2.87M" }, { label: "Growth", value: "+4.2%" }, { label: "Net New ARR", value: "$142K" }, { label: "Churn", value: "1.8%" }] }] },
  { id: "text", name: "Text", description: "Markdown-rendered text with optional heading. Supports bold, italics, lists, links, code.", icon: Type, sections: [{ type: "text", heading: "Executive Summary", body: "Revenue grew **4.2% WoW** to $2.87M, driven by Enterprise expansion. Net new ARR of $142K beat the $120K target.\n\n- Pipeline coverage improved to **3.4x** (target: 3.0x)\n- Customer health score rose to **82/100** (+3 points)\n- Two Enterprise deals ($380K) slipped to Q2 — churn ticked up 0.3pp" }] },
  { id: "kpi-grid", name: "KPI Grid", description: "Metric cards with value, delta, and trend indicator.", icon: TrendingUp, sections: [{ type: "kpi-grid", metrics: [{ label: "Revenue", value: "$2.87M", delta: "+4.2%", trend: "up" }, { label: "Net New ARR", value: "$142K", delta: "+$22K", trend: "up" }, { label: "Churn Rate", value: "1.8%", delta: "+0.3pp", trend: "down" }, { label: "Pipeline Coverage", value: "3.4x", delta: "+0.4x", trend: "up" }] }] },
  { id: "table", name: "Table", description: "Data table with headers, rows, optional caption. Numbers auto-align per theme.", icon: Table2, sections: [{ type: "table", heading: "Deal Pipeline", headers: ["Account", "Stage", "Value", "Close Date", "Owner"], rows: [["Acme Corp", "Negotiation", "$120K", "Apr 15", "Sarah Chen"], ["TechStart Inc", "Proposal", "$85K", "Apr 22", "Mike Torres"], ["GlobalFin", "Discovery", "$340K", "May 10", "Sarah Chen"], ["DataFlow Ltd", "Closed Won", "$95K", "Mar 28", "Raj Patel"]], caption: "Enterprise pipeline as of March 30, 2025" }] },
  { id: "callout", name: "Callout", description: "Colored alert box — info, warning, success, or error.", icon: AlertTriangle, sections: [{ type: "callout", callout_type: "info", message: "Board meeting moved to April 3rd." }, { type: "callout", callout_type: "warning", message: "Two Enterprise deals ($380K combined) slipped to Q2." }, { type: "callout", callout_type: "success", message: "Analytics add-on GA released on schedule." }, { type: "callout", callout_type: "error", message: "Payment processing outage (SEV-1) lasted 47 minutes." }] },
  { id: "quote", name: "Quote", description: "Blockquote with accent border and optional attribution.", icon: Quote, sections: [{ type: "quote", text: "The analytics add-on is exactly what our enterprise customers have been asking for.", attribution: "VP Sales, Q1 Pipeline Review" }] },
  { id: "key-takeaway", name: "Key Takeaway", description: "Prominent conclusion box with accent border and gradient background.", icon: Star, sections: [{ type: "key-takeaway", heading: "Key Takeaway", message: "Revenue momentum is strong (+4.2% WoW) but Q2 churn risk needs immediate attention." }] },
  { id: "stat-highlight", name: "Stat Highlight", description: "Hero stat card — large number centered with label, context, and delta.", icon: TrendingUp, sections: [{ type: "stat-highlight", value: "$2.87M", label: "Weekly Revenue", context: "Highest weekly revenue since Q3 2024.", delta: "+4.2%", trend: "up" }] },
  { id: "two-column", name: "Two Column", description: "Side-by-side markdown panels with optional headings.", icon: Columns2, sections: [{ type: "two-column", left: { heading: "What Went Well", body: "- Revenue beat target by **18%**\n- Analytics GA shipped on schedule\n- Pipeline coverage at 3.4x" }, right: { heading: "Areas for Improvement", body: "- Two Enterprise deals slipped to Q2\n- Churn rate ticked up 0.3pp\n- MQL conversion dropped 5%" } }] },
  { id: "timeline", name: "Timeline", description: "Vertical timeline with dated events.", icon: Clock, sections: [{ type: "timeline", events: [{ date: "14:23 UTC", title: "Alerts triggered" }, { date: "14:35 UTC", title: "Root cause identified" }, { date: "15:10 UTC", title: "Service restored" }] }] },
  { id: "action-items", name: "Action Items", description: "Structured task table with action, owner, due date, and impact.", icon: CheckSquare, sections: [{ type: "action-items", items: [{ action: "Schedule retention calls", owner: "Sarah Chen", due: "Apr 3", impact: "Reduce churn" }] }] },
  { id: "columns", name: "3-Column Layout", description: "Flexible multi-column layout. Each column contains nested sections. Responsive.", icon: Columns2, sections: [{ type: "columns", columns: [{ sections: [{ type: "text", heading: "Revenue", body: "Weekly revenue reached **$2.87M**, up 4.2% WoW. Enterprise segment drove most of the growth." }] }, { sections: [{ type: "text", heading: "Pipeline", body: "Coverage improved to **3.4x** (target: 3.0x). Twelve new opportunities entered discovery." }] }, { sections: [{ type: "text", heading: "Retention", body: "Churn ticked up to **1.8%** (+0.3pp) after two Enterprise deals slipped to Q2." }] }] }] },
  { id: "columns-2", name: "2-Column Mixed Content", description: "Columns can nest any section type — text, charts, callouts.", icon: Columns2, sections: [{ type: "columns", columns: [{ sections: [{ type: "text", heading: "Key Findings", body: "Revenue grew **4.2%**.\n- Pipeline at 3.4x\n- Two deals slipped" }] }, { sections: [{ type: "chart", chart_type: "bar", heading: "Revenue by Region", data: { labels: ["NAM", "EMEA", "APAC"], datasets: [{ name: "$K", values: [1420, 890, 560] }] } }] }] }] },
  { id: "divider", name: "Divider", description: "Horizontal rule, optionally with a centered label.", icon: Minus, sections: [{ type: "divider" }, { type: "divider", label: "Section Break" }] },
  { id: "spacer", name: "Spacer", description: "Empty vertical space. Specify height in px or rem.", icon: MoveVertical, sections: [{ type: "spacer", height: "40px" }] },
]

const CHART_EXAMPLES: ExampleDef[] = [
  { id: "bar-chart", name: "Bar Chart", description: "Vertical grouped bars. Multiple datasets side-by-side.", icon: BarChart3, sections: [{ type: "chart", chart_type: "bar", heading: "Revenue by Region", data: { labels: ["North America", "EMEA", "APAC", "LATAM"], datasets: [{ name: "Q1 Actual", values: [1420, 890, 560, 210] }, { name: "Q1 Target", values: [1300, 950, 500, 250] }] } }] },
  { id: "line-chart", name: "Line Chart", description: "Connected data points with dots.", icon: Activity, sections: [{ type: "chart", chart_type: "line", heading: "Weekly Active Users", data: { labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"], datasets: [{ name: "WAU", values: [12400, 13100, 12800, 14200, 15100, 14800, 16300, 17200] }] } }] },
  { id: "area-chart", name: "Area Chart", description: "Line chart with translucent fill beneath.", icon: Activity, sections: [{ type: "chart", chart_type: "area", heading: "Monthly Recurring Revenue", data: { labels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"], datasets: [{ name: "MRR", values: [5800, 6100, 6400, 6900, 7200, 7600] }] } }] },
  { id: "pie-chart", name: "Pie Chart", description: "Proportional segments with labels and percentages.", icon: PieChart, sections: [{ type: "chart", chart_type: "pie", heading: "Revenue by Segment", data: { segments: [{ label: "Enterprise", value: 1420 }, { label: "Mid-Market", value: 890 }, { label: "SMB", value: 560 }] } }] },
  { id: "donut-chart", name: "Donut Chart", description: "Pie with hollow center. Optional center label.", icon: PieChart, sections: [{ type: "chart", chart_type: "donut", heading: "Support Tickets by Category", data: { segments: [{ label: "Billing", value: 142 }, { label: "Technical", value: 89 }, { label: "Onboarding", value: 56 }, { label: "Feature Request", value: 34 }], center_label: "321 total" } }] },
  { id: "horizontal-bar-chart", name: "Horizontal Bar", description: "Bars extending right. Y-axis labels on left.", icon: BarChart3, sections: [{ type: "chart", chart_type: "horizontal-bar", heading: "Top Performing Reps", data: { labels: ["Sarah Chen", "Mike Torres", "Raj Patel", "Lisa Kim", "James Wu"], datasets: [{ name: "Q1 Revenue ($K)", values: [420, 380, 310, 290, 270] }] } }] },
  { id: "stacked-bar-chart", name: "Stacked Bar", description: "Vertical bars with datasets stacked.", icon: BarChart3, sections: [{ type: "chart", chart_type: "stacked-bar", heading: "Pipeline by Stage", data: { labels: ["Jan", "Feb", "Mar", "Apr"], datasets: [{ name: "Discovery", values: [200, 180, 220, 240] }, { name: "Proposal", values: [150, 170, 160, 190] }, { name: "Negotiation", values: [80, 90, 110, 130] }] } }] },
  { id: "heatmap-chart", name: "Heatmap", description: "2D color grid. Scales: sequential, diverging, red-yellow-green.", icon: Grid3X3, sections: [{ type: "chart", chart_type: "heatmap", heading: "Pipeline Health", data: { x_labels: ["Discovery", "Proposal", "Negotiation", "Closed"], y_labels: ["NAM", "EMEA", "APAC"], values: [[12, 8, 4, 2], [9, 6, 3, 1], [6, 4, 2, 1]], scale: "sequential" } }] },
]

// ─── Themes & Layouts ────────────────────────────────────────────

const THEMES = [
  { id: "default", name: "Default" },
  { id: "executive", name: "Executive" },
  { id: "financial", name: "Financial" },
  { id: "consulting", name: "Consulting" },
  { id: "technical", name: "Technical" },
  { id: "editorial", name: "Editorial" },
]

const NAV = [
  { id: "sections", label: "Sections", icon: Type, count: SECTION_EXAMPLES.length },
  { id: "charts", label: "Charts", icon: BarChart3, count: CHART_EXAMPLES.length },
  { id: "themes", label: "Themes", icon: Palette, count: THEMES.length },
]

// ─── Sanitize config ─────────────────────────────────────────────

const SANITIZE_CONFIG = {
  ADD_TAGS: ["svg", "path", "circle", "rect", "line", "polyline", "polygon", "text", "g", "defs", "clippath"],
  ADD_ATTR: ["style", "viewbox", "fill", "stroke", "stroke-width", "d", "cx", "cy", "r", "x", "y", "x1", "x2", "y1", "y2", "points", "width", "height", "transform", "xmlns", "preserveaspectratio", "stroke-dasharray", "dominant-baseline", "text-anchor", "fill-opacity", "rx", "font-size", "font-weight", "font-family", "data-or-chart", "data-or-columns", "data-or-kpi"],
  FORBID_TAGS: ["script", "iframe", "form"],
  RETURN_TRUSTED_TYPE: false as const,
}

// ─── Preview (pure display) ──────────────────────────────────────

function HtmlPreview({ html }: { html: string | undefined }) {
  if (!html) return (
    <div className="flex items-center justify-center gap-2 py-8 border border-dashed border-border/40 rounded-lg text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Rendering...
    </div>
  )
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden bg-white">
      <div
        className="max-w-none [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto [&_pre]:overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, SANITIZE_CONFIG) }}
      />
    </div>
  )
}

// ─── JSON code block ─────────────────────────────────────────────

function JsonBlock({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(data, null, 2)
  const copy = () => { navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  return (
    <div className="relative group">
      <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 border border-border/40 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10" aria-label="Copy JSON">
        {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
      </button>
      <pre className="text-[12px] leading-relaxed font-mono bg-muted/50 border border-border/40 rounded-lg p-4 overflow-x-auto max-h-[400px] overflow-y-auto text-foreground/80">{json}</pre>
    </div>
  )
}

// ─── Example card ────────────────────────────────────────────────

function ExampleCard({ example, html }: { example: ExampleDef; html: string | undefined }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = example.icon

  return (
    <Card className="py-0 overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-start gap-3 mb-3">
          <div className="size-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm">{example.name}</h3>
              <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4">{example.id}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{example.description}</p>
          </div>
        </div>

        <HtmlPreview html={html} />

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 mt-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <span className="font-mono">JSON structure</span>
        </button>
        {expanded && (
          <div className="mt-2">
            <JsonBlock data={example.sections.length === 1 ? example.sections[0] : example.sections} />
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Page ────────────────────────────────────────────────────────

export function ShowcasePage() {
  const [activeSection, setActiveSection] = useState("sections")
  const [selectedTheme, setSelectedTheme] = useState("default")
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // Single fetch for all previews
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get("/showcase/previews", { params: { theme: selectedTheme } })
      .then(res => { if (!cancelled) setPreviews(res.data.previews) })
      .catch(() => { if (!cancelled) setPreviews({}) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedTheme])

  return (
    <ScrollArea className="h-full">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">

        {/* Hero */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">Reference</Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-2">
            Report Builder
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl">
            Every section type, chart, theme, and layout you can use to build reports.
            Submit as <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">structured_body.sections</code> or
            via <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">client.publish(sections=[...])</code>.
          </p>
        </div>

        {/* Sticky nav + theme selector */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 mb-8 bg-background/80 backdrop-blur-md border-b border-border/40">
          <div className="flex items-center gap-3">
            {/* Section nav */}
            <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1">
              {NAV.map(({ id, label, icon: Icon, count }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                    activeSection === id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                  <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
                </a>
              ))}
            </div>

            {/* Theme switcher */}
            <div className="flex items-center gap-1.5 shrink-0 border-l border-border/40 pl-3">
              <Palette className="size-3.5 text-muted-foreground" />
              <select
                value={selectedTheme}
                onChange={e => setSelectedTheme(e.target.value)}
                className="text-xs font-medium bg-transparent border border-border/40 rounded-md px-2 py-1 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                {THEMES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {loading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </div>

        <div className="space-y-16">

          {/* Sections */}
          <section id="sections" className="scroll-mt-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="font-mono text-[11px] font-semibold text-primary/60 uppercase tracking-[0.15em]">Section Types</span>
              <div className="flex-1 h-px bg-border" />
              <span className="font-mono text-[10px] text-muted-foreground">{SECTION_EXAMPLES.length} types</span>
            </div>
            <div className="space-y-4">
              {SECTION_EXAMPLES.map(ex => (
                <ExampleCard key={ex.id} example={ex} html={previews[ex.id]} />
              ))}
            </div>
          </section>

          {/* Charts */}
          <section id="charts" className="scroll-mt-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="font-mono text-[11px] font-semibold text-primary/60 uppercase tracking-[0.15em]">Chart Types</span>
              <div className="flex-1 h-px bg-border" />
              <span className="font-mono text-[10px] text-muted-foreground">{CHART_EXAMPLES.length} types</span>
            </div>
            <div className="space-y-4">
              {CHART_EXAMPLES.map(ex => (
                <ExampleCard key={ex.id} example={ex} html={previews[ex.id]} />
              ))}
            </div>
          </section>

          {/* Themes */}
          <section id="themes" className="scroll-mt-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="font-mono text-[11px] font-semibold text-primary/60 uppercase tracking-[0.15em]">Themes</span>
              <div className="flex-1 h-px bg-border" />
              <span className="font-mono text-[10px] text-muted-foreground">{THEMES.length} themes</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Use the theme dropdown above to switch — all previews on this page re-render in the selected theme.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg border transition-all cursor-pointer text-sm",
                    selectedTheme === t.id
                      ? "border-primary bg-primary/5 font-semibold text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <HtmlPreview html={previews["__theme_sample"]} />
          </section>


        </div>

        {/* Footer */}
        <div className="mt-16 mb-8 pt-8 border-t border-border/40 text-center">
          <p className="font-mono text-[11px] text-muted-foreground">
            {SECTION_EXAMPLES.length} section types · {CHART_EXAMPLES.length} chart types · {THEMES.length} themes
          </p>
        </div>
      </div>
    </ScrollArea>
  )
}
