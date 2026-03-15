import { useState } from "react"
import { Link } from "react-router-dom"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  FileCode2,
  ExternalLink,
  BookOpen,
  BrainCircuit,
  Wrench,
  FileSignature,
  Terminal,
  Users,
  Briefcase,
  Copy,
  Check,
  Cpu,
  GitFork,
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
      <div className="code-surface rounded-sm px-4 py-3 font-mono text-sm pr-12 overflow-x-auto">
        {code}
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

const PLATFORMS = [
  {
    id: "claude-code",
    name: "Claude Code",
    badge: "Recommended",
    badgeColor: "bg-signal/100",
    steps: [
      { label: "Install via plugin marketplace", code: `/plugin marketplace add https://agentskill.sh/marketplace.json\n/plugin install learn@agentskill-sh` },
      { label: "Or clone directly to global skills dir", code: `git clone https://github.com/agentskill-sh/learn.git ~/.claude/skills/learn` },
    ]
  },
  {
    id: "cursor",
    name: "Cursor",
    badge: null,
    steps: [
      { label: "Clone to Cursor skills directory", code: `git clone https://github.com/agentskill-sh/learn.git ~/.cursor/skills/learn` },
    ]
  },
  {
    id: "antigravity",
    name: "Antigravity",
    badge: null,
    steps: [
      { label: "Clone to Antigravity skills directory", code: `git clone https://github.com/agentskill-sh/learn.git ~/.antigravity/skills/learn` },
      { label: "Or install per-project", code: `git clone https://github.com/agentskill-sh/learn.git .agents/skills/learn` },
    ]
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    badge: null,
    steps: [
      { label: "Install via Copilot CLI", code: `/plugin install https://github.com/agentskill-sh/learn` },
      { label: "Or clone manually", code: `git clone https://github.com/agentskill-sh/learn.git ~/.copilot/skills/learn` },
    ]
  },
  {
    id: "codex",
    name: "OpenAI Codex",
    badge: null,
    steps: [
      { label: "Clone to Codex skills directory", code: `git clone https://github.com/agentskill-sh/learn.git ~/.codex/skills/learn` },
    ]
  },
  {
    id: "other",
    name: "Other",
    badge: null,
    steps: [
      { label: "Copy SKILL.md to your platform's skills dir", code: `# Claude Code:   ~/.claude/skills/learn/SKILL.md\n# Cursor:         ~/.cursor/skills/learn/SKILL.md\n# Windsurf:       ~/.windsurf/skills/learn/SKILL.md\n# Codex:          ~/.codex/skills/learn/SKILL.md\n# Cline:          ~/.cline/skills/learn/SKILL.md\n# Goose:          ~/.goose/skills/learn/SKILL.md` },
    ]
  },
]

export function SkillsGuidePage() {
  const [platform, setPlatform] = useState("claude-code")

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-4xl mx-auto p-6 md:p-8 pb-16">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Hero */}
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-signal/10 rounded-2xl mb-4">
            <FileCode2 className="size-8 text-violet-500" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Building Skills
          </h1>
          <p className="text-lg text-muted-foreground">
            Skills are plain-text Markdown files that teach any AI assistant how to perform a specific task — no code, no SDK, no deployment pipeline.
          </p>
        </div>

        {/* Audience Tabs */}
        <Tabs defaultValue="business" className="mb-14">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Who is this for?</h2>
            <TabsList className="bg-muted">
              <TabsTrigger value="business" className="gap-2 data-[state=active]:bg-card">
                <Briefcase className="size-4" /> Business
              </TabsTrigger>
              <TabsTrigger value="developer" className="gap-2 data-[state=active]:bg-card">
                <Terminal className="size-4" /> Developer
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="business">
            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: <Briefcase className="size-5 text-primary" />,
                  bg: "bg-primary/10",
                  title: "Domain Expertise",
                  body: "Package your company's specialized knowledge into reusable instructions — legal review processes, financial report templates, data pipeline documentation."
                },
                {
                  icon: <GitFork className="size-5 text-signal" />,
                  bg: "bg-signal/10",
                  title: "Repeatable Workflows",
                  body: "Turn multi-step business processes into consistent, auditable outcomes. A skill for reporting always follows the same validation steps."
                },
                {
                  icon: <Users className="size-5 text-signal" />,
                  bg: "bg-signal/10",
                  title: "Team Knowledge",
                  body: "Capture institutional knowledge in version-controlled packages. When someone leaves the team, their expertise stays in the skills they wrote."
                },
              ].map(item => (
                <Card key={item.title} className="border-border">
                  <CardContent className="pt-6">
                    <div className={`size-10 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>{item.icon}</div>
                    <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="developer">
            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: <BrainCircuit className="size-5 text-signal" />,
                  bg: "bg-signal/10",
                  title: "Write Once, Run Everywhere",
                  body: "The same SKILL.md file works across 25+ compatible platforms: Claude, Cursor, Codex, Windsurf, Copilot, Gemini CLI, and more."
                },
                {
                  icon: <Cpu className="size-5 text-signal" />,
                  bg: "bg-signal/10",
                  title: "Progressive Disclosure",
                  body: "Skills are only loaded when relevant. AI assistants read the description to decide when to activate, keeping your context window efficient."
                },
                {
                  icon: <Wrench className="size-5 text-signal" />,
                  bg: "bg-signal/10",
                  title: "Composable with MCPs",
                  body: "Skills describe *when* and *how* to use Model Context Protocol tools. Pair a skill with the postgres-mcp or jira-mcp for powerful automations."
                },
              ].map(item => (
                <Card key={item.title} className="border-border">
                  <CardContent className="pt-6">
                    <div className={`size-10 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>{item.icon}</div>
                    <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Install Skills */}
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-foreground mb-2 border-b pb-2">Installing Skills on Your AI Assistant</h2>
          <p className="text-muted-foreground mb-6 text-sm">Install the <code className="bg-muted text-signal px-1 py-0.5 rounded">/learn</code> command to search and install 100,000+ skills from <a href="https://agentskill.sh" target="_blank" rel="noopener noreferrer" className="text-signal underline">agentskill.sh</a> mid-conversation.</p>

          <div className="flex flex-wrap gap-2 mb-6">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium border transition-all ${platform === p.id ? "code-surface border-transparent shadow-md" : "bg-card text-muted-foreground border-border hover:border-border"}`}
              >
                {p.name}
                {p.badge && <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.badgeColor} text-white font-semibold`}>{p.badge}</span>}
              </button>
            ))}
          </div>

          {PLATFORMS.filter(p => p.id === platform).map(p => (
            <div key={p.id} className="space-y-3">
              {p.steps.map((step, i) => (
                <CodeBlock key={i} code={step.code} label={step.label} />
              ))}
            </div>
          ))}

          <div className="mt-6 p-4 bg-muted rounded-xl border border-border">
            <h4 className="font-semibold text-foreground mb-3 text-sm">Once installed, use <code className="bg-secondary text-signal px-1 rounded">/learn</code> commands:</h4>
            <div className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
              {[
                { cmd: "/learn", desc: "Context-aware skill recommendations" },
                { cmd: "/learn trending", desc: "See popular skills right now" },
                { cmd: "/learn @anthropic/seo-optimizer", desc: "Install a specific skill" },
                { cmd: "/learn list", desc: "List all installed skills" },
                { cmd: "/learn update", desc: "Update all skills to latest" },
                { cmd: "/learn remove <slug>", desc: "Uninstall a skill" },
              ].map(item => (
                <div key={item.cmd} className="flex gap-2 items-start">
                  <code className="bg-secondary text-signal px-1.5 py-0.5 rounded text-xs font-mono shrink-0">{item.cmd}</code>
                  <span className="text-muted-foreground text-xs mt-0.5">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Anatomy Section */}
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-foreground mb-2 border-b pb-2">Anatomy of a SKILL.md File</h2>
          <p className="text-muted-foreground mb-4">
            A skill is just a <code className="bg-muted text-signal px-1 py-0.5 rounded">.md</code> file with two parts: YAML frontmatter for metadata and a body with instructions. No code required.
            The hosted <code className="bg-muted text-signal px-1 py-0.5 rounded">/skill.md</code> endpoint provides the canonical source for automation.
          </p>

          <Card className="code-surface border-0 shadow-lg overflow-hidden mb-6 rounded-sm">
            <div className="flex border-b border-white/10 px-4 py-2 text-xs font-mono text-white/50 gap-4">
              <span className="text-violet-400">.agents/skills/</span>ad-metrics/SKILL.md
            </div>
            <CardContent className="p-0 font-mono text-sm">
              <div className="p-4 border-b border-white/10 relative group">
                <div className="absolute right-4 top-4 text-xs font-sans text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">YAML Frontmatter</div>
                <span className="text-muted-foreground">---</span><br />
                <span className="text-blue-400">name</span><span className="text-muted-foreground">: "Google Ads Analyzer"</span><br />
                <span className="text-blue-400">description</span><span className="text-muted-foreground">: "Analyze Google Ads performance and generate an ROI report. Use when user asks for ad campaign analysis."</span><br />
                <span className="text-muted-foreground">---</span>
              </div>
              <div className="p-4 text-muted-foreground relative group">
                <div className="absolute right-4 top-4 text-xs font-sans text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Body Instructions</div>
                <span className="text-violet-400 font-bold"># Google Ads Weekly Analyzer</span><br /><br />
                <span className="text-muted-foreground/60 italic">// Tell the AI assistant which tools it MUST use</span><br />
                You are a digital marketing AI assistant. Use the following MCPs:<br />
                1. `google-ads-mcp` to pull campaign metrics for the last 7 days.<br />
                2. `postgres-mcp` to cross-reference clicks with confirmed purchases.<br /><br />
                <span className="text-violet-400 font-bold">## Output Format</span><br />
                Format the result as an <strong>Open Reporting HTML artifact</strong> using a clean executive dark-mode aesthetic.
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            {[
              { step: "1", title: "Initialize the File", body: "Create `.agents/skills/<your-skill-name>/SKILL.md` in your project. The folder name becomes the skill's slug." },
              { step: "2", title: "Define the Trigger", body: "Write the YAML `description` carefully. This is how the AI assistant knows *when* to activate this skill. Be specific — include trigger phrases like 'Use when the user asks for...'." },
              { step: "3", title: "Write Explicit Steps", body: "Numbered checklists work best. Instead of 'Analyze the DB', write '1. Query public.users WHERE active=true. 2. Group by signup_date. 3. Return the top 10 cohorts.'." },
              { step: "4", title: "Publish to Open Reporting", body: "Tell the AI assistant to format its final output as an Open Reporting HTML artifact and submit it here. Your reports become the institutional memory of your team." },
            ].map(item => (
              <div key={item.step} className="flex gap-4 items-start">
                <div className="size-8 shrink-0 rounded-full bg-signal/15 text-signal text-sm font-bold flex items-center justify-center mt-0.5 border border-signal/20">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 border-b pb-2">Official Resources</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                icon: <BookOpen className="size-5 text-signal" />,
                bg: "bg-signal/10",
                title: "agentskill.sh — Skill Directory",
                desc: "Browse 100,000+ skills, see install counts, security scores, and install anything with a single command.",
                href: "https://agentskill.sh",
                label: "Browse skills",
              },
              {
                icon: <FileSignature className="size-5 text-signal" />,
                bg: "bg-signal/10",
                title: "The /learn Install Guide",
                desc: "Step-by-step instructions for Claude Code, Claude Desktop, Cursor, Copilot, Codex, Antigravity and more.",
                href: "https://agentskill.sh/install",
                label: "View install guide",
              },
              {
                icon: <FileCode2 className="size-5 text-signal" />,
                bg: "bg-signal/10",
                title: "SKILL.md Specification",
                desc: "The complete specification — required fields, optional fields, naming rules, and directory structure.",
                href: "https://agentskill.sh/readme",
                label: "Read specification",
              },
              {
                icon: <BookOpen className="size-5 text-primary" />,
                bg: "bg-primary/10",
                title: "Anthropic's Building Skills Guide",
                desc: "Anthropic's official playbook on writing durable, advanced skills and prompts for Claude.",
                href: "https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf",
                label: "Read PDF guide",
              },
            ].map(r => (
              <div key={r.title} className="p-5 border border-border rounded-xl hover:border-border hover:shadow-sm transition-all flex gap-4">
                <div className={`size-10 rounded-lg ${r.bg} flex items-center justify-center shrink-0 mt-0.5`}>{r.icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground mb-1 text-sm">{r.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{r.desc}</p>
                  <Button asChild size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                    <a href={r.href} target="_blank" rel="noopener noreferrer">
                      {r.label} <ExternalLink className="size-3" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open Standard note */}
        <div className="p-4 bg-muted rounded-xl border border-border text-sm text-muted-foreground flex items-start gap-3">
          <FileCode2 className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
          <span>
            The SKILL.md format is an <strong className="text-foreground">open standard</strong> supported by 25+ AI development tools. Skills are portable — write once, use across Claude, Cursor, Codex, Windsurf, Antigravity, Copilot, and more.
          </span>
        </div>

      </main>
    </ScrollArea>
  )
}
