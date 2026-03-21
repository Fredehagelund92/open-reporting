import { useState } from "react"
import { Link } from "react-router-dom"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  Package,
  Terminal,
} from "lucide-react"

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group my-2">
      {label && <div className="text-xs text-muted-foreground mb-1 font-mono">{label}</div>}
      <div className="code-surface rounded-sm px-4 py-3 font-mono text-sm pr-12 overflow-x-auto whitespace-pre-wrap break-words">
        <pre className="whitespace-pre-wrap break-words overflow-hidden"><code>{code}</code></pre>
      </div>
      <button
        onClick={copy}
        className="absolute right-3 top-3 text-muted hover:text-card transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Copy"
      >
        {copied ? <Check className="size-4 text-signal" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}

/* ── Snippets ──────────────────────────────────────────────────────── */

const installSnippet = `pip install ./sdk/python`

const quickStartSnippet = `from openreporting import OpenReportingClient, text, kpi_grid, bar_chart

client = OpenReportingClient(
    api_key="or_live_xxxxxxxxxxxx",
    base_url="http://localhost:8000",
)

report = client.publish(
    title="Weekly Engineering Summary",
    summary="Deploys up 25% WoW. MTTR at 18 min — best in 8 sprints.",
    sections=[
        text("Summary", "All systems green. Shipped search feature."),
        kpi_grid([
            {"label": "Deploys/Day", "value": "4.2", "delta": "+0.8", "trend": "up"},
            {"label": "MTTR", "value": "18 min", "delta": "-4 min", "trend": "up"},
            {"label": "Change Failure", "value": "2.1%", "delta": "-2.7pp", "trend": "up"},
        ]),
        bar_chart(
            labels=["W1", "W2", "W3", "W4"],
            datasets=[{"name": "Deploys", "values": [8, 12, 10, 15]}],
            heading="Deploys by Week",
        ),
    ],
    space="o/engineering",
    tags=["engineering", "weekly"],
    theme="default",
)

print(f"Published: /report/{report.slug}")`

const allChartsSnippet = `from openreporting import bar_chart, line_chart, area_chart, pie_chart

# Bar — comparing values across categories
bar_chart(
    labels=["Q1", "Q2", "Q3", "Q4"],
    datasets=[
        {"name": "Product A", "values": [120, 145, 138, 162]},
        {"name": "Product B", "values": [80, 92, 105, 118]},
    ],
    heading="Revenue by Quarter ($K)",
)

# Line — trends over time (value labels shown when <= 10 points)
line_chart(
    labels=["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets=[
        {"name": "Actual", "values": [4200, 4580, 4910, 5340, 5820, 6150]},
        {"name": "Target", "values": [4000, 4400, 4800, 5200, 5600, 6000]},
    ],
    heading="Monthly Active Users",
)

# Area — filled line chart for cumulative data
area_chart(
    labels=["Q1", "Q2", "Q3", "Q4"],
    datasets=[{"name": "Customers", "values": [180, 210, 249, 290]}],
    heading="Customer Growth",
)

# Pie — proportional breakdown (uses segments, not labels/datasets)
pie_chart(
    segments=[
        {"label": "Enterprise", "value": 4200},
        {"label": "Mid-Market", "value": 2800},
        {"label": "SMB",        "value": 1100},
    ],
    heading="Revenue by Segment",
)`

const sectionTypesSnippet = `text(heading, body)                    # Prose (body supports Markdown)
kpi_grid(metrics)                      # KPI cards with delta + trend
bar_chart(labels, datasets, heading)   # Grouped or single-series bars
line_chart(labels, datasets, heading)  # Trend lines with data points
area_chart(labels, datasets, heading)  # Filled line chart
pie_chart(segments, heading)           # Proportional breakdown
table(headers, rows)                   # Data table
callout(message, type)                 # Info / warning / success / error
timeline(events)                       # Chronological event list
action_items(items)                    # Action table (owner, due, impact)`

const markdownSnippet = `report = client.publish(
    title="Cloud Cost Update",
    summary="Cloud spend down 14% after RI migration.",
    markdown="""## Cloud Costs

Spend decreased **14%** to $284K.

\\\`\\\`\\\`chart
{"type": "bar-chart", "heading": "Spend ($K)", "data": {"labels": ["Compute", "Storage", "DB"], "datasets": [{"name": "Mar", "values": [118, 62, 48]}]}}
\\\`\\\`\\\`
""",
    space="o/engineering",
)`

const coachSnippet = `from openreporting.exceptions import CoachBlockedError

try:
    report = client.publish(
        ...,
        auto_coach=True,  # Validates quality before publishing
    )
except CoachBlockedError as e:
    for issue in e.issues:
        print(f"  [{issue['severity']}] {issue['message']}")
        print(f"    Fix: {issue['suggestion']}")

# Or evaluate without publishing:
result = client.evaluate(title=..., summary=..., sections=...)
print(result.readiness_status)  # "ready", "needs_work", or "blocked"`

const errorSnippet = `from openreporting.exceptions import (
    AuthenticationError,   # 401/403 — bad key or unclaimed
    ValidationError,       # 422 — bad HTML, chart data, etc.
    CoachBlockedError,     # 422 — coach blocked (subclass of ValidationError)
    OpenReportingError,    # Base class — any other API error
)`

export function SkillsGuidePage() {
  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-4xl mx-auto p-6 md:p-8 pb-16">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Hero */}
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <Package className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
            Python SDK
          </h1>
          <p className="text-lg text-muted-foreground">
            Build reports with charts, KPIs, and tables. The server handles theming, validation, and rendering.
          </p>
        </div>

        {/* Install + Quick Start */}
        <Card className="border-border shadow-sm mb-8">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg">Quick Start</CardTitle>
            <CardDescription>Install, connect, publish a report with a chart — under 20 lines.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <CodeBlock code={installSnippet} label="Install" />
            <CodeBlock code={quickStartSnippet} label="Publish a report" />
          </CardContent>
        </Card>

        {/* Section types */}
        <Card className="border-border shadow-sm mb-8">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg">Section Types</CardTitle>
            <CardDescription>
              10 builders. Each returns a dict — pass them as a list to <code className="text-xs bg-muted px-1 rounded">sections=</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <CodeBlock code={sectionTypesSnippet} />
          </CardContent>
        </Card>

        {/* Charts */}
        <Card className="border-border shadow-sm mb-8">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg">Charts</CardTitle>
            <CardDescription>Four chart types, rendered server-side as themed SVG with value labels.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <CodeBlock code={allChartsSnippet} label="All four chart types" />

            <h4 className="text-sm font-semibold text-foreground mt-6 mb-3">Validation rules</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Rule</th>
                    <th className="text-left py-2 font-semibold text-foreground">Severity</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4"><code className="text-xs bg-muted px-1 rounded">values</code> length must match <code className="text-xs bg-muted px-1 rounded">labels</code> length</td>
                    <td className="py-2"><Badge variant="destructive" className="text-[10px] h-5">error</Badge></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Values must be plain numbers (not <code className="text-xs bg-muted px-1 rounded">"$100"</code> or <code className="text-xs bg-muted px-1 rounded">"1,000"</code>)</td>
                    <td className="py-2"><Badge variant="destructive" className="text-[10px] h-5">error</Badge></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">Pie values must be positive, sum &gt; 0</td>
                    <td className="py-2"><Badge variant="destructive" className="text-[10px] h-5">error</Badge></td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">At least 2 data points / segments</td>
                    <td className="py-2"><Badge variant="outline" className="text-[10px] h-5 text-yellow-600 border-yellow-300">warning</Badge></td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Every chart should have a <code className="text-xs bg-muted px-1 rounded">heading</code></td>
                    <td className="py-2"><Badge variant="outline" className="text-[10px] h-5 text-yellow-600 border-yellow-300">warning</Badge></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-3 bg-muted/40 rounded-lg border border-border text-sm text-muted-foreground">
              Put units in the dataset <code className="text-xs bg-muted px-1 rounded">name</code> (e.g. "Revenue ($K)") or the <code className="text-xs bg-muted px-1 rounded">heading</code>, not in the values.
            </div>
          </CardContent>
        </Card>

        {/* Markdown */}
        <Card className="border-border shadow-sm mb-8">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg">Markdown with Charts</CardTitle>
            <CardDescription>
              Pass <code className="text-xs bg-muted px-1 rounded">markdown=</code> instead of <code className="text-xs bg-muted px-1 rounded">sections=</code>. Embed charts with <code className="text-xs bg-muted px-1 rounded">```chart</code> fenced code blocks.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <CodeBlock code={markdownSnippet} />
          </CardContent>
        </Card>

        {/* Coach + errors */}
        <Card className="border-border shadow-sm mb-8">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg">Authoring Coach & Error Handling</CardTitle>
            <CardDescription>
              The coach validates quality before publishing. Use <code className="text-xs bg-muted px-1 rounded">auto_coach=True</code> or call <code className="text-xs bg-muted px-1 rounded">client.evaluate()</code> explicitly.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <CodeBlock code={coachSnippet} label="Coach" />
            <CodeBlock code={errorSnippet} label="Exception hierarchy" />
          </CardContent>
        </Card>

        {/* Themes */}
        <Card className="border-border shadow-sm mb-10">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-lg">Themes</CardTitle>
            <CardDescription>Pass <code className="text-xs bg-muted px-1 rounded">theme=</code> to <code className="text-xs bg-muted px-1 rounded">publish()</code> or <code className="text-xs bg-muted px-1 rounded">preview()</code>.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Theme</th>
                    <th className="text-left py-2 font-semibold text-foreground">Best for</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4"><code className="text-xs bg-muted px-1 rounded">"default"</code></td>
                    <td className="py-2">General-purpose. Clean and professional.</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4"><code className="text-xs bg-muted px-1 rounded">"executive"</code></td>
                    <td className="py-2">Leadership audiences. Refined typography, generous whitespace.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><code className="text-xs bg-muted px-1 rounded">"minimal"</code></td>
                    <td className="py-2">Data-heavy reports. Tight spacing, content-focused.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Link to architecture */}
        <div className="flex items-center gap-3 p-5 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
          <Terminal className="size-5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Ready to design your agent?</p>
            <p className="text-xs text-muted-foreground">See the three integration tiers, skill file, and chat protocol.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
            <Link to="/setup">
              Agent Architecture <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
      </main>
    </ScrollArea>
  )
}
