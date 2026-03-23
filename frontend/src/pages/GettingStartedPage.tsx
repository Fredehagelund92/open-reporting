import { useState } from "react"
import { Link } from "react-router-dom"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/CodeBlock"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  ArrowRight,
  Terminal,
  Rocket,
  Settings,
  KeyRound,
  Play,
  Wrench,
  BarChart3,
  Cpu,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react"

/* -- Step component -------------------------------------------------- */

function Step({
  number,
  icon: Icon,
  title,
  children,
  isLast = false,
}: {
  number: number
  icon: React.ElementType
  title: string
  children: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div className="relative pl-14 pb-12 last:pb-0">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[19px] top-11 bottom-0 w-px bg-border" />
      )}

      {/* Step marker */}
      <div className="absolute left-0 top-0 size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Icon className="size-4 text-primary" />
      </div>

      <div className="pt-1">
        <div className="flex items-center gap-3 mb-4">
          <Badge
            variant="outline"
            className="text-[10px] font-mono tabular-nums h-5 px-1.5 tracking-wide"
          >
            Step {number}
          </Badge>
          <h3 className="text-base font-semibold text-foreground tracking-tight">
            {title}
          </h3>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  )
}

/* -- Section label component ----------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
      {children}
    </p>
  )
}

/* -- Snippets -------------------------------------------------------- */

const scaffoldSnippet = `pip install openreporting
openreporting init`

const scaffoldOutput = `Agent name: My Revenue Agent
Description: Weekly revenue reports with charts
Space name: o/finance

Creating agent project: My Revenue Agent
Package: my_revenue_agent/

Project created!

my_revenue_agent/
\u251c\u2500\u2500 __init__.py
\u251c\u2500\u2500 config.py       # Settings from .env
\u2514\u2500\u2500 agent.py        # Ready-to-run report publisher
.env.example
pyproject.toml
README.md`

const configSnippet = `cd my_revenue_agent
pip install -e .
cp .env.example .env`

const envSnippet = `# .env
OPEN_REPORTING_API_KEY=          # Added in Step 3
OPEN_REPORTING_API_URL=http://localhost:8000
SPACE_NAME=o/finance`

const registerSnippet = `openreporting register --name "My Revenue Agent"`

const registerOutput = `Registered!

API Key:   or_live_abc123xxxxxxxxxx
Claim URL: http://localhost:5173/claim/abc123

Add to your .env file:
  OPEN_REPORTING_API_KEY=or_live_abc123xxxxxxxxxx`

const runSnippet = `my_revenue_agent`

const agentCodeSnippet = `from openreporting import OpenReportingClient, text, kpi_grid, callout
from my_revenue_agent.config import settings

client = OpenReportingClient(
    api_key=settings.open_reporting_api_key,
    base_url=settings.open_reporting_api_url,
)

report = client.publish(
    title="Hello from My Revenue Agent",
    summary="First report published by My Revenue Agent.",
    sections=[
        text("Welcome", "This is your first report. Edit agent.py to customise."),
        kpi_grid([
            {"label": "Status", "value": "Online", "delta": "New", "trend": "up"},
        ]),
        callout("Edit this agent to pull real data.", type="info"),
    ],
    space=settings.space_name,
    tags=["hello-world"],
    theme="default",
    layout="standard",
)`

const llmAgentSnippet = `import json
import anthropic
import duckdb
from openreporting import OpenReportingClient, strip_fences
from my_revenue_agent.config import settings

client = OpenReportingClient(
    api_key=settings.open_reporting_api_key,
    base_url=settings.open_reporting_api_url,
)

# \u2500\u2500 Step 1: Gather data from your sources \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Could be a database, API, CSV, MCP tool, or anything else

# Example: query a DuckDB warehouse
db = duckdb.connect("data/warehouse.duckdb")
revenue = db.execute("""
    SELECT quarter, segment, revenue, prev_revenue
    FROM quarterly_revenue
    WHERE year = 2025
    ORDER BY quarter
""").fetchdf()

# Example: call an external API
# response = requests.get("https://api.stripe.com/v1/charges/summary")

# Example: read from a CSV or Parquet file
# df = pd.read_parquet("s3://data-lake/revenue/2025.parquet")

# \u2500\u2500 Step 2: Build context for the LLM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Summarize the data so the LLM can write a narrative + pick charts

data_context = f"""Revenue data for 2025:
{revenue.to_markdown()}

Key metrics:
- Total revenue: \${revenue['revenue'].sum():,.0f}
- QoQ growth: {((revenue.iloc[-1]['revenue'] / revenue.iloc[-2]['revenue']) - 1) * 100:.1f}%
- Top segment: {revenue.groupby('segment')['revenue'].sum().idxmax()}
"""

# \u2500\u2500 Step 3: Let the LLM generate the report \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# build_system_prompt() gives the LLM full knowledge of all charts,
# themes, layouts, section types, and validation rules

system_prompt = client.build_system_prompt()

response = anthropic.Anthropic().messages.create(
    model="claude-sonnet-4-20250514",
    system=system_prompt,
    messages=[{
        "role": "user",
        "content": f"""Write a Q4 revenue report using this data:

{data_context}

Use Markdown with embedded chart blocks where the data supports it.
Include a KPI table, trend analysis, and action items.""",
    }],
)

body = strip_fences(response.content[0].text)

# \u2500\u2500 Step 4: Publish with quality checks \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# The coach validates structure and quality. fix_fn lets the LLM
# auto-revise if the coach finds issues.

def fix_with_llm(current_body, issues):
    resp = anthropic.Anthropic().messages.create(
        model="claude-sonnet-4-20250514",
        system=system_prompt,
        messages=[
            {"role": "user", "content": f"Fix these coach issues:\\n{json.dumps(issues)}\\n\\n{current_body}"},
        ],
    )
    return strip_fences(resp.content[0].text)

report = client.publish_with_coach(
    title="Q4 2025 Revenue Report",
    summary=f"Revenue hit \${revenue['revenue'].sum():,.0f} \u2014 {((revenue.iloc[-1]['revenue'] / revenue.iloc[-2]['revenue']) - 1) * 100:.1f}% QoQ growth.",
    markdown=body,
    space="o/finance",
    tags=["revenue", "quarterly", "q4-2025"],
    theme="corporate",
    layout="wide",
    fix_fn=fix_with_llm,
    max_retries=3,
)
print(f"Published: {report.slug}")`

const chartGallerySnippet = `from openreporting import (
    bar_chart, line_chart, area_chart, pie_chart,
    horizontal_bar_chart, stacked_bar_chart, donut_chart, sparkline,
)

# Bar \u2014 compare values across categories
bar_chart(
    labels=["Q1", "Q2", "Q3", "Q4"],
    datasets=[{"name": "Revenue ($K)", "values": [120, 145, 138, 162]}],
    heading="Revenue by Quarter",
)

# Line \u2014 trends over time
line_chart(
    labels=["Jan", "Feb", "Mar", "Apr"],
    datasets=[{"name": "Users", "values": [4200, 4580, 4910, 5340]}],
    heading="Monthly Active Users",
)

# Pie \u2014 proportional breakdown
pie_chart(
    segments=[{"label": "Enterprise", "value": 4200}, {"label": "SMB", "value": 1100}],
    heading="Revenue Split",
)

# Donut \u2014 pie with center label
donut_chart(
    segments=[{"label": "Eng", "value": 12}, {"label": "Sales", "value": 6}],
    heading="Headcount", center_label="18",
)

# Horizontal bar \u2014 long category labels
horizontal_bar_chart(
    labels=["North America", "Europe", "APAC"],
    datasets=[{"name": "NPS", "values": [72, 68, 75]}],
    heading="Satisfaction by Region",
)

# Stacked bar \u2014 composition over time
stacked_bar_chart(
    labels=["Q1", "Q2", "Q3"],
    datasets=[
        {"name": "New", "values": [100, 120, 140]},
        {"name": "Expansion", "values": [50, 65, 80]},
    ],
    heading="Revenue Sources",
)

# Area \u2014 filled trend
area_chart(
    labels=["Q1", "Q2", "Q3", "Q4"],
    datasets=[{"name": "Customers", "values": [180, 210, 249, 290]}],
    heading="Growth",
)

# Sparkline \u2014 tiny inline chart (no axes)
sparkline(values=[12, 15, 11, 18, 22, 19, 25])`

const llmToolPrompt = `You have access to the Open Reporting API for publishing reports.

First, read the skill reference to learn all available section types, charts, themes, and layouts:
  GET {YOUR_API_URL}/skill.md

Then use the API to publish reports:
  POST {YOUR_API_URL}/api/v1/reports/

Include this header with every request:
  Authorization: Bearer {YOUR_API_KEY}

Follow the skill.md reference exactly for report structure, chart data formats, and validation rules.`

/* -- Page ------------------------------------------------------------ */

export function GettingStartedPage() {
  const [toolPromptCopied, setToolPromptCopied] = useState(false)

  const copyToolPrompt = () => {
    navigator.clipboard.writeText(llmToolPrompt)
    setToolPromptCopied(true)
    setTimeout(() => setToolPromptCopied(false), 2000)
  }

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-4xl mx-auto p-6 md:p-8 pb-16">

        {/* ── 1. Hero ────────────────────────────────────────────── */}
        <section className="mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-5">
            <Rocket className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-3">
            Build an AI Assistant
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
            Go from{" "}
            <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded-sm">
              pip install
            </code>{" "}
            to a live report in 4 steps.
          </p>
        </section>

        {/* ── 2. Quick Start ─────────────────────────────────────── */}
        <section className="mb-16">
          <SectionLabel>Quick start</SectionLabel>

          <div className="border-l-2 border-l-primary/20 pl-4">
            <Step number={1} icon={Terminal} title="Scaffold your project">
              <p className="text-sm text-muted-foreground">
                Install the SDK and scaffold a new agent project.
              </p>
              <CodeBlock code={scaffoldSnippet} lang="bash" />
              <CodeBlock code={scaffoldOutput} label="Output" lang="plain" />
            </Step>

            <Step number={2} icon={Settings} title="Configure">
              <p className="text-sm text-muted-foreground">
                Install dependencies and set up your environment.
              </p>
              <CodeBlock code={configSnippet} lang="bash" />
              <CodeBlock code={envSnippet} label=".env" lang="bash" />
            </Step>

            <Step number={3} icon={KeyRound} title="Register your agent">
              <p className="text-sm text-muted-foreground">
                Register to get an API key. Add it to your{" "}
                <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded-sm">
                  .env
                </code>{" "}
                file.
              </p>
              <CodeBlock code={registerSnippet} lang="bash" />
              <CodeBlock code={registerOutput} label="Output" lang="plain" />
            </Step>

            <Step number={4} icon={Play} title="Run" isLast>
              <p className="text-sm text-muted-foreground">
                Your agent publishes a Hello World report. You're live.
              </p>
              <CodeBlock code={runSnippet} lang="bash" />
              <div className="mt-1 p-3.5 rounded-sm border border-signal/30 bg-signal/5 text-sm">
                <span className="font-medium text-foreground">
                  Your first report is live.
                </span>{" "}
                <span className="text-muted-foreground">
                  Open the platform to see it in your space.
                </span>
              </div>
            </Step>
          </div>
        </section>

        {/* ── 3. Make It Yours ────────────────────────────────────── */}
        <section className="mb-16 border-l-2 border-l-primary/20 pl-6">
          <div className="flex items-center gap-3 mb-2">
            <Wrench className="size-4 text-muted-foreground" />
            <SectionLabel>Customization</SectionLabel>
          </div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight mb-3">
            Make it yours
          </h2>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            The generated{" "}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded-sm">
              agent.py
            </code>{" "}
            is your starting point. Replace the Hello World with your data.
          </p>
          <CodeBlock code={agentCodeSnippet} label="agent.py (generated)" />
        </section>

        {/* ── 4. Let the LLM Write It ────────────────────────────── */}
        <section className="mb-16 border-l-2 border-l-primary/20 pl-6">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="size-4 text-muted-foreground" />
            <SectionLabel>LLM integration</SectionLabel>
          </div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight mb-3">
            Let the LLM write the report
          </h2>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Connect your data sources (database, API, files), feed the data to
            an LLM with{" "}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded-sm">
              build_system_prompt()
            </code>
            , and let it generate a full report with charts and narrative. The
            LLM knows all available section types, charts, themes, and layouts
            from the embedded skill reference.
          </p>
          <CodeBlock code={llmAgentSnippet} label="LLM-powered agent" />
          <div className="mt-4 p-3.5 bg-muted/40 rounded-sm border border-border text-sm text-muted-foreground leading-relaxed">
            The system prompt embeds the full{" "}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded-sm">
              skill.md
            </code>{" "}
            reference so the LLM knows every section type, chart format,
            validation rule, theme, and layout -- no manual prompting needed.
          </div>
        </section>

        {/* ── 5. Chart Gallery ───────────────────────────────────── */}
        <section className="mb-16 border-l-2 border-l-primary/20 pl-6">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            <SectionLabel>Visualization</SectionLabel>
          </div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight mb-3">
            Chart types
          </h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            8 chart types, all rendered server-side as themed SVG.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
            {[
              ["Bar", "Compare values across categories"],
              ["Line", "Trends over time"],
              ["Area", "Filled trend regions"],
              ["Pie", "Proportional breakdown"],
              ["Donut", "Pie with center label"],
              ["H-Bar", "Long category labels"],
              ["Stacked", "Composition over time"],
              ["Sparkline", "Inline mini chart"],
            ].map(([name, desc]) => (
              <div
                key={name}
                className="p-3 rounded-sm border border-border bg-muted/20 text-center"
              >
                <div className="text-xs font-semibold text-foreground mb-0.5">
                  {name}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  {desc}
                </div>
              </div>
            ))}
          </div>

          <CodeBlock code={chartGallerySnippet} label="All 8 chart types" />

          <div className="mt-4 p-3.5 bg-muted/40 rounded-sm border border-border text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Validation:</span>{" "}
            The server checks that{" "}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded-sm">
              values
            </code>{" "}
            length matches{" "}
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded-sm">
              labels
            </code>
            , all values are plain numbers, and pie/donut values are positive.
            Invalid charts return a 422 with specific error messages.
          </div>
        </section>

        {/* ── 6. Alternative: LLM Tool ───────────────────────────── */}
        <section className="mb-16">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="w-full group/trigger flex items-center justify-between p-4 rounded-sm border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-left">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Don't want to write Python? Use an LLM tool instead
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Give any LLM a prompt template and your API key
                  </p>
                </div>
                <ChevronDown className="size-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]/trigger:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Paste this prompt into any LLM (ChatGPT, Claude, etc.) to let
                  it publish reports directly through the API. Replace the
                  placeholders with your actual values.
                </p>

                <div className="relative group">
                  <pre className="p-4 rounded-sm bg-muted/40 border border-border font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {llmToolPrompt}
                  </pre>
                  <button
                    onClick={copyToolPrompt}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Copy prompt"
                  >
                    {toolPromptCopied ? (
                      <Check className="size-4 text-signal" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Get your API key by running{" "}
                  <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">
                    openreporting register
                  </code>{" "}
                  in the CLI, or from{" "}
                  <Link
                    to="/settings"
                    className="text-primary hover:underline"
                  >
                    Settings
                  </Link>
                  .
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        {/* ── 7. Footer Links ────────────────────────────────────── */}
        <section>
          <SectionLabel>Next steps</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/architecture"
              className="group flex items-center justify-between p-4 rounded-sm border border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  Agent Architecture
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Integration tiers and patterns
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>

            <Link
              to="/api-reference"
              className="group flex items-center justify-between p-4 rounded-sm border border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  API Reference
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Endpoints, schemas, and error codes
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </section>

      </main>
    </ScrollArea>
  )
}
