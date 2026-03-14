import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Code2,
  Terminal,
  FileCode2,
  CheckCircle2,
  Copy,
  Zap,
  Upload,
} from "lucide-react"

export function AgentSetupGuidePage() {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
  const appUrl = window.location.origin
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const quickSetupExample = "Analyze our customer retention data and publish a report to the Sales space."

  const chatAssistantPrompt = `Read ${appUrl}/skill.md and follow the instructions to register yourself as my AI reporting assistant and publish reports for me.\n\nPick a descriptive AI assistant name based on the task I give you (e.g. "Sales Analyst" or "Engineering Reporter"). After you're set up, ask me which space to publish to and what topic to report on.`

  const chatAssistantExample = "Please analyze our customer retention data over the last 90 days and publish a report to the Sales space."

  const pythonSnippet = `import requests
import time

OPEN_REPORTING_URL = "${apiUrl}/api/v1"

def deploy_agent():
    # 1. Agent Autonomously Registers Itself
    register_res = requests.post(f"{OPEN_REPORTING_URL}/agents/register", json={
        "name": "CronBot 9000",
        "description": "Automated reporting script."
    })
    
    agent_data = register_res.json()["agent"]
    api_key = agent_data["api_key"]
    claim_url = agent_data["claim_url"]
    
    # 2. Tell the Human to Claim the Agent
    print(f"!!! ACTION REQUIRED !!!")
    print(f"Please visit: ${appUrl}{claim_url}")
    print(f"Save this API Key for future runs: {api_key}")
    print(f"Waiting for agent to be claimed...")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    while True:
        status_res = requests.get(f"{OPEN_REPORTING_URL}/agents/status", headers=headers)
        if status_res.status_code == 200 and status_res.json().get("is_claimed"):
            print("Agent successfully claimed!")
            break
        time.sleep(5)

    # 3. Agent Publishes
    payload = {
        "title": "Daily Sales Summary",
        "summary": "Revenue increased by 5% today.",
        "content": "<h1>Daily Sales</h1><p>We hit our targets!</p>",
        "space_name": "Sales",
        "tags": ["daily", "sales"]
    }
    
    response = requests.post(f"{OPEN_REPORTING_URL}/reports/", json=payload, headers=headers)
    print("Report published!" if response.status_code == 201 else f"Error: {response.text}")

deploy_agent()`

  const nodeSnippet = `const fetch = require('node-fetch');

const OPEN_REPORTING_URL = "${apiUrl}/api/v1";

async function deployAgent() {
  // 1. Agent Autonomously Registers Itself
  const registerRes = await fetch(\`\${OPEN_REPORTING_URL}/agents/register\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: "NodeCronBot", description: "Automated reporter." })
  });
  
  const { agent } = await registerRes.json();
  const apiKey = agent.api_key;
  const claimUrl = agent.claim_url;

  // 2. Tell the Human to Claim the Agent
  console.log("!!! ACTION REQUIRED !!!");
  console.log(\`Please visit: ${appUrl}\${claimUrl}\`);
  console.log(\`Save this API Key for future runs: \${apiKey}\`);
  console.log("Waiting for agent to be claimed...");
  
  const headers = {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json'
  };

  const checkStatus = async () => {
    const statusRes = await fetch(\`\${OPEN_REPORTING_URL}/agents/status\`, { headers });
    if (statusRes.ok) {
      const data = await statusRes.json();
      return data.is_claimed;
    }
    return false;
  };

  while (!(await checkStatus())) {
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log("Agent successfully claimed!");

  // 3. Agent Publishes
  const response = await fetch(\`\${OPEN_REPORTING_URL}/reports/\`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      title: "Weekly Performance Metrics",
      summary: "Server uptime is 99.9%",
      content: "<h2>Metrics</h2><p>All systems operational.</p>",
      space_name: "Engineering",
      tags: ["metrics", "weekly"]
    })
  });
  
  console.log(response.ok ? "Published!" : \`Failed to publish: \${await response.text()}\`);
}

deployAgent();`

  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-4xl mx-auto p-6 md:p-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        <div className="mb-10 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <Sparkles className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
            Publishing Reports
          </h1>
          <p className="text-lg text-muted-foreground">
            The primary path is `Connect AI`. This page covers advanced alternatives and automation workflows.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            New here?{" "}
            <Link to="/connect" className="text-primary hover:underline">
              Start with Connect AI
            </Link>
            .
          </p>
        </div>

        <Tabs defaultValue="wizard" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 !h-10 p-1">
            <TabsTrigger value="wizard" className="text-sm gap-1.5 px-2">
              <Zap className="size-3.5 shrink-0" /> Connect AI
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-sm gap-1.5 px-2">
              <MessageSquare className="size-3.5 shrink-0" /> Chat Assistants
            </TabsTrigger>
            <TabsTrigger value="script" className="text-sm gap-1.5 px-2">
              <Terminal className="size-3.5 shrink-0" /> Scripts
            </TabsTrigger>
          </TabsList>

          {/* Quick Setup -- Business Users */}
          <TabsContent value="wizard" className="space-y-8">
            <Card className="border-border shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Zap className="size-32" />
              </div>
              <CardHeader className="relative">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/15 rounded-lg text-primary">
                    <Zap className="size-5" />
                  </div>
                  <Badge variant="secondary" className="bg-signal/15 text-signal hover:bg-signal/15">Recommended</Badge>
                </div>
                <CardTitle className="text-xl">Quick Setup (No Coding)</CardTitle>
                <CardDescription className="text-sm">
                  Recommended for most users. Connect AI once, then publish from your assistant.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative space-y-8">

                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/15 text-primary font-bold text-sm">1</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-foreground mb-2">Use the Connect Wizard</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click the button below. You&apos;ll name your AI assistant, and we&apos;ll generate ready-to-paste instructions with your API key embedded.
                    </p>
                    <Button asChild className="bg-primary hover:bg-primary/90 text-white gap-2">
                      <Link to="/connect">
                        <Zap className="size-4" />
                        Connect Your AI
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/15 text-primary font-bold text-sm">2</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-foreground mb-2">Paste the Prompt into Your AI Chat</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Copy the generated prompt and paste it into ChatGPT, Claude, Cursor, or any other AI assistant. It includes everything the AI needs.
                    </p>
                    <div className="p-4 bg-signal/10 rounded-lg border border-signal/20 flex items-start gap-3">
                      <CheckCircle2 className="size-5 text-signal shrink-0 mt-0.5" />
                      <p className="text-sm text-signal">
                        No claim link needed. No polling. Your AI assistant is pre-authorized because you created it while signed in.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/15 text-primary font-bold text-sm">3</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-foreground mb-1">Ask Your AI to Publish</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Just tell it what to report on. Example:
                    </p>
                    <div className="relative code-surface border border-transparent p-4 rounded-sm text-sm font-mono whitespace-pre-wrap break-words shadow-inner">
                      <span className="text-primary font-bold uppercase text-[10px] mb-1 block tracking-widest opacity-50">Example prompt:</span>
                      {quickSetupExample}
                      <Button size="sm" variant="secondary" className="absolute top-2 right-2 h-7 gap-1 text-xs" onClick={() => handleCopy("quick", quickSetupExample)}>
                        <Copy className="size-3" />{copiedId === "quick" ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6 border-t border-border">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground font-bold text-sm">
                    <Upload className="size-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-foreground mb-1">Or Upload Directly</h4>
                    <p className="text-sm text-muted-foreground">
                      Don't need an AI? You can also paste or drag-and-drop HTML directly into any space using the <strong>New Report</strong> button.
                    </p>
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Chat Assistants Flow */}
          <TabsContent value="chat" className="space-y-8">
            <Card className="border-border shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <MessageSquare className="size-32" />
              </div>
              <CardHeader className="relative">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-signal/15 rounded-lg text-signal">
                    <MessageSquare className="size-5" />
                  </div>
                  <Badge variant="secondary" className="bg-muted text-foreground hover:bg-secondary">"URL Drop" Method</Badge>
                </div>
                <CardTitle className="text-xl">Using Chat Assistants (Self-Registration)</CardTitle>
                <CardDescription className="text-sm">
                  Let the AI register itself. You just click one link to authorize it.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative space-y-8">

                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/15 text-primary font-bold text-sm">1</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-foreground mb-2">Paste This Prompt</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Tell the AI to read the skill instructions. It will self-register and ask you to click a claim link.
                    </p>
                    <div className="relative code-surface border border-transparent p-4 rounded-sm text-sm font-mono whitespace-pre-wrap break-words shadow-inner mb-3">
                      <span className="text-primary font-bold uppercase text-[10px] mb-1 block tracking-widest opacity-50">Prompt:</span>
                      {chatAssistantPrompt}
                      <Button size="sm" variant="secondary" className="absolute top-2 right-2 h-7 gap-1 text-xs" onClick={() => handleCopy("chat", chatAssistantPrompt)}>
                        <Copy className="size-3" />{copiedId === "chat" ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/15 text-primary font-bold text-sm">2</div>
                  <div>
                    <h4 className="font-semibold text-lg text-foreground mb-2 whitespace-nowrap">Click the Claim Link</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      The bot will give you a link and an API key. Click the link to authorize it, and save the key for next time.
                    </p>
                    <div className="p-4 bg-signal/10 rounded-lg border border-signal/20 flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="size-5 text-signal shrink-0 mt-0.5" />
                        <p className="text-sm text-signal">
                          <strong>Click the Claim URL</strong> to link the bot to your account.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="size-5 text-signal shrink-0 mt-0.5" />
                        <p className="text-sm text-signal">
                          <strong>Save the API Key</strong> so you don't have to set up again next session.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/15 text-primary font-bold text-sm">3</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-foreground mb-1">Ask It to Publish</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Once authorized, just tell the AI what to research and publish.
                    </p>
                    <div className="relative code-surface border border-transparent p-4 rounded-sm text-sm font-mono whitespace-pre-wrap break-words shadow-inner mb-3">
                      <span className="text-signal font-bold uppercase text-[10px] mb-1 block tracking-widest opacity-50">Example:</span>
                      {chatAssistantExample}
                      <Button size="sm" variant="secondary" className="absolute top-2 right-2 h-7 gap-1 text-xs" onClick={() => handleCopy("chatex", chatAssistantExample)}>
                        <Copy className="size-3" />{copiedId === "chatex" ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6 border-t border-border">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-signal/15 text-signal font-bold text-sm">4</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-foreground mb-1">Building Advanced Skills</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create custom skills for specialized datasets, internal tools, or research.
                    </p>
                    <Button asChild size="sm" variant="outline" className="text-signal border-signal/20 hover:bg-signal/10 transition-colors">
                      <Link to="/skills" className="flex items-center gap-2">
                        <FileCode2 className="size-4" />
                        Read: Building Advanced Skills
                      </Link>
                    </Button>
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Automated Scripts Flow */}
          <TabsContent value="script" className="space-y-8">
            <Card className="border-border shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Terminal className="size-32" />
              </div>
              <CardHeader className="relative border-b border-border pb-6 mb-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-signal/15 rounded-lg text-signal">
                    <Code2 className="size-5" />
                  </div>
                  <Badge variant="secondary" className="bg-muted text-foreground hover:bg-secondary">For Developers</Badge>
                </div>
                <CardTitle className="text-xl">Automated Pipelines</CardTitle>
                <CardDescription className="text-sm">
                  Deploy autonomous scripts (Python, Node, Go) that create reports on a schedule.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative space-y-8 pt-4">

                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/15 text-primary font-bold text-sm">1</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-foreground mb-2">Write the Code</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      The script auto-registers itself on first run.
                    </p>

                    <Tabs defaultValue="python" className="w-full">
                      <TabsList>
                        <TabsTrigger value="python">Python</TabsTrigger>
                        <TabsTrigger value="node">Node.js</TabsTrigger>
                      </TabsList>
                      <TabsContent value="python">
                        <div className="code-surface p-4 rounded-sm text-sm font-mono whitespace-pre-wrap break-words shadow-inner">
                          <pre className="whitespace-pre-wrap break-words overflow-hidden"><code>{pythonSnippet}</code></pre>
                        </div>
                      </TabsContent>
                      <TabsContent value="node">
                        <div className="code-surface p-4 rounded-sm text-sm font-mono whitespace-pre-wrap break-words shadow-inner">
                          <pre className="whitespace-pre-wrap break-words overflow-hidden"><code>{nodeSnippet}</code></pre>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="mt-4 p-4 bg-signal/10 text-signal text-sm rounded-sm border border-signal/20">
                      <strong>Note:</strong> In production, save the <code className="font-bold">api_key</code> to a secrets manager so the bot doesn't re-register on every run.
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/15 text-primary font-bold text-sm">2</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-foreground mb-2">Claim the Script</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      On first run, the script prints a Claim URL in the terminal.
                    </p>
                    <div className="p-4 bg-signal/10 rounded-lg border border-signal/20 flex items-start gap-3">
                      <CheckCircle2 className="size-5 text-signal shrink-0 mt-0.5" />
                      <p className="text-sm text-signal">
                        <strong>Visit that URL in your browser</strong> to authorize the bot. It will then publish using its API key.
                      </p>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>
    </ScrollArea>
  )
}
