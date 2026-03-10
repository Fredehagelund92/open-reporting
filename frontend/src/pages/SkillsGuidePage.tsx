import { Link } from "react-router-dom"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ArrowLeft,
  FileCode2,
  ExternalLink,
  BookOpen,
  BrainCircuit,
  Wrench,
  FileSignature
} from "lucide-react"

export function SkillsGuidePage() {
  return (
    <ScrollArea className="flex-1 bg-white">
      <main className="max-w-4xl mx-auto p-6 md:p-8 pb-16">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-amber-600 mb-6 transition-colors">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        {/* Hero Section */}
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-violet-50 rounded-2xl mb-4">
            <FileCode2 className="size-8 text-violet-500" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Building Skills
          </h1>
          <p className="text-lg text-slate-600">
            Learn how to turn any AI agent into an expert on your company's proprietary data and workflows using a simple, plain-text Markdown file.
          </p>
        </div>

        {/* Section 1: First Principles */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-2">1. First Principles: The 3 Pillars of an Agent</h2>
          <p className="text-slate-600 mb-6 text-lg">
            Before building a Skill, it helps to understand what an AI Agent actually is. At its core, an agent requires three components to be useful in a professional environment:
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <div className="size-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                  <BrainCircuit className="size-5" />
                </div>
                <CardTitle className="text-lg">The Brain (LLMs)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Models like Claude or GPT can reason and generate text, but out-of-the-box they only know training data up to a certain date. They cannot dynamically search your private databases or ticket trackers.
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <div className="size-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                  <Wrench className="size-5" />
                </div>
                <CardTitle className="text-lg">The Hands (MCPs)</CardTitle>
                <CardDescription>Model Context Protocol</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                MCPs are APIs specifically designed for LLMs. They give the Brain "hands" by allowing it to securely read your Jira tickets, query PostgreSQL, or search Salesforce in real-time.
              </CardContent>
            </Card>

            <Card className="border-slate-200 border-2 border-violet-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2"><Badge className="bg-violet-500 text-white border-0 hover:bg-violet-600">Start Here</Badge></div>
              <CardHeader className="pb-2">
                <div className="size-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center mb-2">
                  <FileSignature className="size-5" />
                </div>
                <CardTitle className="text-lg">The Roadmap (Skills)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 font-medium">
                A Skill is the blueprint you write. It tells the Brain exactly <span className="text-violet-700 italic">when</span> and <span className="text-violet-700 italic">how</span> to use its Hands to achieve a specific business outcome.
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 2: Anatomy of a Skill */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-2">2. Anatomy of a SKILL.md file</h2>
          <p className="text-slate-600 mb-4">
            A Skill does not require any coding languages. It is simply a Markdown (<code className="bg-slate-100 text-violet-700 px-1 py-0.5 rounded">.md</code>) instructional document containing two main parts: the <strong>Frontmatter</strong> (metadata) and the <strong>Body</strong> (instructions).
          </p>

          <Card className="bg-slate-900 border-0 shadow-lg overflow-hidden">
            <div className="flex border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs font-mono text-slate-400 gap-4">
              <span className="text-violet-400">./skills/</span>ad-metrics/SKILL.md
            </div>
            <CardContent className="p-0 font-mono text-sm">
              <div className="p-4 bg-slate-800/50 border-b border-slate-800 relative group">
                <div className="absolute right-4 top-4 text-xs font-sans text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">YAML Frontmatter</div>
                <span className="text-slate-400">---</span><br />
                <span className="text-blue-400">name</span><span className="text-slate-300">: "Google Ads Analyzer"</span><br />
                <span className="text-blue-400">description</span><span className="text-slate-300">: "Analyze Google Ads campaign performance and generate an ROI report."</span><br />
                <span className="text-slate-400">---</span>
              </div>
              <div className="p-4 text-slate-300 relative group">
                <div className="absolute right-4 top-4 text-xs font-sans text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Body Instructions</div>
                <span className="text-violet-400 font-bold"># Google Ads Weekly Analyzer</span><br /><br />
                <span className="text-muted-foreground/60 italic">// Tell the agent which tools it MUST use</span><br />
                You are a digital marketing agent. Your goal is to analyze ad spend using the following MCPs:<br />
                1. The `google-ads-mcp` to pull campaign metrics (clicks, impressions, cost) for the last 7 days.<br />
                2. The `postgres-mcp` to cross-reference those clicks with actual confirmed product purchases in our DB.<br /><br />

                <span className="text-muted-foreground/60 italic">// Tell the agent how to format its final output</span><br />
                <span className="text-violet-400 font-bold">## Output Format</span><br />
                Format your final analysis as an <strong>Open Reporting HTML Artifact</strong>.<br />
                Ensure you use modern TailwindCSS utility classes directly in the HTML for styling, adopting an executive "Dark Mode" aesthetic.
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Section 3: Tutorial */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-2">3. Creating Your First Skill</h2>

          <div className="space-y-6">
            {[
              {
                step: "1",
                title: "Initialize the File",
                body: "In your project directory, create a new folder named `.agents/skills/`. Inside it, create a new folder for your specific skill, and place a file inside named `SKILL.md`."
              },
              {
                step: "2",
                title: "Define the Trigger",
                body: "Write the YAML frontmatter at the very top of the file. The `description` field is extremely critical—this is how the Assistant AI knows exactly *when* to activate this skill during a conversation."
              },
              {
                step: "3",
                title: "Write Explicit Steps",
                body: "Do not leave room for assumptions. LLMs work best with numbered checklists. Instead of 'Analyze the DB', write '1. Query the public.users table. 2. Filter for active=true. 3. Group by signup_date.'"
              },
              {
                step: "4",
                title: "Publish to Open Reporting",
                body: "At the end of your instructions, explicitly tell the agent to output the final result here on the platform using standard HTML artifacts and visually beautiful CSS."
              },
            ].map(item => (
              <div key={item.step} className="flex gap-4 items-start">
                <div className="size-8 shrink-0 rounded-full bg-violet-100 text-violet-700 text-sm font-bold flex items-center justify-center mt-0.5 border border-violet-200">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg mb-1">{item.title}</h3>
                  <p className="text-slate-600">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Official Resources */}
        <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-2">4. Official Resources</h2>
        <Card className="mb-8 border-violet-100 bg-violet-50/50 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="size-5 text-violet-600" />
                <CardTitle className="text-lg font-semibold text-slate-900">Anthropic's "Building Skills" Guide</CardTitle>
              </div>
              <p className="text-sm text-slate-600 max-w-xl">
                For a deep dive into writing the most effective instructions for Claude and other LLMs, Anthropic provides an officially curated playbook on building durable, advanced Prompts and Skills.
              </p>
            </div>
            <Button asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shrink-0 shadow-sm mt-2">
              <a href="https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf" target="_blank" rel="noopener noreferrer">
                Read PDF Guide <ExternalLink className="size-4" />
              </a>
            </Button>
          </CardHeader>
        </Card>


      </main>
    </ScrollArea>
  )
}
