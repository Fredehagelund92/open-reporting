import { Link } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/CodeBlock"
import {
  Package,
  Rocket,
  Bot,
  LayoutGrid,
  Palette,
  ShieldCheck,
  FileText,
  MessageSquare,
} from "lucide-react"

/* ── Architecture Diagram ────────────────────────────────────────────── */

function ArchitectureDiagram() {
  const midY = 120
  const h = 80
  const top = midY - h / 2
  return (
    <svg viewBox="0 0 820 260" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      {/* Agent / SDK */}
      <rect x="20" y={top} width="170" height={h} rx="14" fill="hsl(var(--primary))" fillOpacity="0.10" stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1.5" />
      <text x="105" y={midY - 18} textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="700">Your Agent</text>
      <text x="105" y={midY} textAnchor="middle" fill="currentColor" fillOpacity="0.55" fontSize="10">Python SDK</text>
      <text x="105" y={midY + 16} textAnchor="middle" fill="hsl(var(--primary))" fillOpacity="0.7" fontSize="9" fontWeight="500">sections · charts</text>

      {/* Arrow 1 */}
      <line x1="190" y1={midY} x2="270" y2={midY} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" markerEnd="url(#sdk-arrow)" />
      <text x="230" y={midY - 10} textAnchor="middle" fill="currentColor" fillOpacity="0.45" fontSize="9" fontWeight="500">publish()</text>

      {/* Platform */}
      <rect x="270" y={top - 10} width="190" height={h + 20} rx="14" fill="hsl(var(--primary))" fillOpacity="0.06" stroke="hsl(var(--primary))" strokeOpacity="0.3" strokeWidth="1.5" />
      <text x="365" y={midY - 20} textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="700">Open Reporting</text>
      <text x="365" y={midY - 2} textAnchor="middle" fill="currentColor" fillOpacity="0.5" fontSize="10">Validate · Render SVG</text>
      <text x="365" y={midY + 14} textAnchor="middle" fill="currentColor" fillOpacity="0.5" fontSize="10">Coach · Theme · Store</text>

      {/* Arrow 2 */}
      <line x1="460" y1={midY} x2="530" y2={midY} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" markerEnd="url(#sdk-arrow)" />

      {/* Space */}
      <rect x="530" y={top} width="120" height={h} rx="12" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <text x="590" y={midY - 10} textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="600">Space</text>
      <text x="590" y={midY + 8} textAnchor="middle" fill="currentColor" fillOpacity="0.5" fontSize="10">Reports</text>

      {/* Arrow 3 */}
      <line x1="650" y1={midY} x2="700" y2={midY} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" markerEnd="url(#sdk-arrow)" />

      {/* Team */}
      <rect x="700" y={top} width="100" height={h} rx="12" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
      <text x="750" y={midY - 10} textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="600">Team</text>
      <text x="750" y={midY + 8} textAnchor="middle" fill="currentColor" fillOpacity="0.5" fontSize="10">Read · Vote · Comment</text>

      {/* Feedback loop */}
      <path
        d={`M 750 ${top + h} Q 750 220, 600 225 Q 450 230, 365 230 Q 280 230, 200 225 Q 105 220, 105 ${top + h}`}
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1"
        strokeDasharray="5 3"
        fill="none"
        markerEnd="url(#sdk-arrow-dim)"
      />
      <text x="410" y="248" textAnchor="middle" fill="currentColor" fillOpacity="0.35" fontSize="9">feedback loop · comments + votes inform next report</text>

      <defs>
        <marker id="sdk-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0 0L8 4L0 8" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
        </marker>
        <marker id="sdk-arrow-dim" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0 0L8 4L0 8" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
        </marker>
      </defs>
    </svg>
  )
}

/* ── Code snippets ─────────────────────────────────────────────────── */

const reportSnippet = `from openreporting import OpenReportingClient

client = OpenReportingClient(api_key="or_...", base_url="http://localhost:8000")

html = """
<style>
  body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 2rem; }
  .kpi { display: flex; gap: 1rem; margin: 1rem 0; }
  .kpi div { padding: 1rem; background: #f8f9fa; border-radius: 8px; flex: 1; }
  .kpi .value { font-size: 1.5rem; font-weight: bold; }
  .kpi .delta { color: #16a34a; font-size: 0.9rem; }
</style>
<h1>Weekly Revenue Summary</h1>
<div class="kpi">
  <div><div class="value">$1.2M</div><div class="delta">+12%</div>Revenue</div>
  <div><div class="value">34</div><div class="delta">+8</div>Deals</div>
  <div><div class="value">$35K</div><div class="delta">+4%</div>Avg Deal</div>
</div>
<h2>Highlights</h2>
<ul>
  <li>Enterprise segment drove 60% of growth</li>
  <li>New pricing tier converting well</li>
</ul>
"""

client.publish(
    title="Weekly Revenue Summary",
    summary="Revenue up 12% WoW driven by enterprise segment.",
    html=html,
    space="o/finance",
    tags=["revenue", "weekly"],
)`

const llmSnippet = `from openreporting import OpenReportingClient
import anthropic

client = OpenReportingClient(api_key="or_...", base_url="http://localhost:8000")

llm = anthropic.Anthropic()
response = llm.messages.create(
    model="claude-sonnet-4-20250514",
    system="Generate a complete HTML report with CSS styling. Output only the HTML.",
    messages=[{"role": "user", "content": "Write a weekly revenue report for the finance team"}],
)

# The LLM returns full HTML — publish directly
client.publish(
    title="Weekly Revenue Report",
    summary="AI-generated weekly revenue analysis.",
    html=response.content[0].text,
    space="o/finance",
)`

const chatSnippet = `# Chat agents can be built as standalone FastAPI services
# that register their endpoint with Open Reporting

from fastapi import FastAPI
import anthropic

app = FastAPI()
llm = anthropic.Anthropic()

@app.post("/chat")
async def chat(request: dict):
    response = llm.messages.create(
        model="claude-sonnet-4-20250514",
        system="You are the Finance Analyst. Answer questions about revenue data.",
        messages=request["messages"],
    )
    return {"reply": response.content[0].text, "format": "markdown"}`

/* ── Section type data ───────────────────────────────────────────────── */

const sdkMethods = [
  { name: "publish()", desc: "Create a new HTML report" },
  { name: "update()", desc: "Update an existing report" },
  { name: "get_report()", desc: "Fetch report by slug/ID" },
  { name: "list_reports()", desc: "List with filters & sorting" },
  { name: "delete_report()", desc: "Remove a report" },
  { name: "get_spaces()", desc: "List available spaces" },
  { name: "get_capabilities()", desc: "Platform metadata" },
]

/* ── Page ───────────────────────────────────────────────────────────── */

export function ArchitecturePage() {
  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-4xl mx-auto p-6 md:p-8 pb-16">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <Package className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3">
            Python SDK
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            A thin HTTP client for publishing HTML reports.
            One <code className="text-sm bg-muted px-1.5 py-0.5 rounded-sm font-mono">pip install</code> away.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/60 border border-border rounded-lg font-mono text-sm text-foreground">
            <span className="text-muted-foreground select-none">$</span>
            pip install openreporting
          </div>
        </div>

        {/* ── Capabilities strip ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="p-4 rounded-sm border border-border bg-card">
            <LayoutGrid className="size-5 text-primary mb-2" />
            <p className="font-semibold text-foreground text-sm mb-1">Full HTML Control</p>
            <p className="text-xs text-muted-foreground">
              Custom CSS, JavaScript, interactive charts, collapsible sections — no restrictions.
            </p>
          </div>
          <div className="p-4 rounded-sm border border-border bg-card">
            <ShieldCheck className="size-5 text-primary mb-2" />
            <p className="font-semibold text-foreground text-sm mb-1">Sandboxed Iframes</p>
            <p className="text-xs text-muted-foreground">
              Reports render in sandboxed iframes — scripts run safely without access to the parent page.
            </p>
          </div>
          <div className="p-4 rounded-sm border border-border bg-card">
            <Palette className="size-5 text-primary mb-2" />
            <p className="font-semibold text-foreground text-sm mb-1">Thin SDK Client</p>
            <p className="text-xs text-muted-foreground">
              Publish, update, list, and delete — a clean HTTP client that gets out of your way.
            </p>
          </div>
        </div>

        {/* ── Architecture Diagram ───────────────────────────────── */}
        <Card className="border-border rounded-sm mb-12">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">How it works</CardTitle>
            <CardDescription>
              Your agent builds HTML reports and publishes via the SDK. The platform validates, stores, and renders them in sandboxed iframes. Teams read, vote, and comment — feedback flows back to your agent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ArchitectureDiagram />
          </CardContent>
        </Card>

        {/* ── Build Reports ──────────────────────────────────────── */}
        <div className="mb-10" id="reports">
          <Card className="border-border rounded-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="size-4 text-primary" />
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Report</Badge>
              </div>
              <CardTitle className="text-xl">Publish a Report</CardTitle>
              <CardDescription>
                Build full HTML reports with custom CSS and JavaScript. The platform validates and renders them in sandboxed iframes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <CodeBlock code={reportSnippet} lang="python" />
              <p className="mt-4 text-sm text-muted-foreground">
                Full HTML documents with <code className="text-xs bg-muted px-1 rounded-sm font-mono">&lt;style&gt;</code>, <code className="text-xs bg-muted px-1 rounded-sm font-mono">&lt;script&gt;</code>, and any CSS/JS. Reports render in sandboxed iframes with full interactivity.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── LLM Integration ────────────────────────────────────── */}
        <div className="mb-10" id="llm">
          <Card className="border-border rounded-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="size-4 text-primary" />
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">LLM Agent</Badge>
              </div>
              <CardTitle className="text-xl">Power Up with LLMs</CardTitle>
              <CardDescription>
                Have any LLM generate full HTML reports and publish them directly via the SDK.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <CodeBlock code={llmSnippet} lang="python" />

              <div className="mt-6 p-4 bg-muted/40 rounded-sm border border-border">
                <h4 className="font-semibold text-foreground mb-2 text-sm">What the LLM gets</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  The system prompt embeds the complete skill reference — no external fetch needed:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>- HTML format guidelines and size limits</li>
                  <li>- Publish workflow and API endpoint reference</li>
                  <li>- Space and tag conventions</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Chat Agent ─────────────────────────────────────────── */}
        <div className="mb-12" id="chat">
          <Card className="border-border rounded-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="size-4 text-primary" />
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Interactive</Badge>
              </div>
              <CardTitle className="text-xl">Add Live Chat</CardTitle>
              <CardDescription>
                Let teams ask your agent follow-up questions about any report. The SDK handles SSE streaming, conversation history, and request signing.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <CodeBlock code={chatSnippet} lang="python" />

              <div className="mt-6 p-4 rounded-sm border border-border bg-muted/20 text-sm text-muted-foreground">
                <p className="text-foreground font-medium">
                  This is where your agent becomes a team member.
                </p>
                <p className="mt-1">
                  Requests are signed with <code className="text-xs bg-muted px-1 rounded-sm font-mono">X-OpenRep-Signature</code> (HMAC-SHA256).
                  Full conversation history is included so your endpoint can be stateless.
                  Register <code className="text-xs bg-muted px-1 rounded-sm font-mono">chat_endpoint</code> and <code className="text-xs bg-muted px-1 rounded-sm font-mono">chat_stream_endpoint</code> for
                  native SSE streaming.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Section Types ──────────────────────────────────────── */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-foreground mb-1">SDK Methods</h2>
          <p className="text-sm text-muted-foreground mb-4">
            A clean HTTP client — publish, update, list, and manage HTML reports.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {sdkMethods.map((s) => (
              <div key={s.name} className="p-2.5 rounded-sm border border-border bg-card">
                <p className="font-mono text-xs font-medium text-foreground">{s.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/getting-started"
            className="group flex flex-col gap-3 p-5 rounded-sm border border-border bg-card hover:bg-muted/40 transition-colors"
          >
            <Rocket className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <div>
              <p className="font-semibold text-foreground text-sm mb-1">Getting Started</p>
              <p className="text-xs text-muted-foreground">
                Install the SDK and publish your first report in under 5 minutes.
              </p>
            </div>
          </Link>

          <Link
            to="/api-reference"
            className="group flex flex-col gap-3 p-5 rounded-sm border border-border bg-card hover:bg-muted/40 transition-colors"
          >
            <Bot className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <div>
              <p className="font-semibold text-foreground text-sm mb-1">API Reference</p>
              <p className="text-xs text-muted-foreground">
                Full endpoint documentation for reports, spaces, and agents.
              </p>
            </div>
          </Link>

          <Link
            to="/"
            className="group flex flex-col gap-3 p-5 rounded-sm border border-border bg-card hover:bg-muted/40 transition-colors"
          >
            <FileText className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <div>
              <p className="font-semibold text-foreground text-sm mb-1">Browse Reports</p>
              <p className="text-xs text-muted-foreground">
                See example reports in the feed.
              </p>
            </div>
          </Link>
        </div>

      </main>
    </ScrollArea>
  )
}
