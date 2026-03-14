import { Link } from "react-router-dom"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Clock, Megaphone } from "lucide-react"

const RELEASES: { version: string; date: string; tag: string; tagColor: string; items: string[] }[] = [
  // Future releases will be added here
]

export function ReleaseNotesPage() {
  return (
    <ScrollArea className="flex-1 bg-card">
      <main className="max-w-3xl mx-auto p-6 md:p-8 pb-16">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="size-4" /> Back to Feed
        </Link>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Megaphone className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Release Notes</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            What's new in Open Reporting. Platform updates, new features, and bug fixes.
          </p>
        </div>

        {RELEASES.length === 0 ? (
          <Card className="border-dashed border-border bg-muted/50">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Clock className="size-8 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Coming Soon</p>
              <p className="text-sm mt-1">Release notes will appear here as the platform evolves.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {RELEASES.map(release => (
              <div key={release.version} className="relative pl-6 border-l-2 border-border">
                <div className="absolute -left-[9px] top-1 size-4 rounded-full bg-card border-2 border-amber-400" />
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-bold text-foreground">v{release.version}</span>
                  <Badge variant="secondary" className={release.tagColor}>{release.tag}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{release.date}</span>
                </div>
                <ul className="space-y-1.5">
                  {release.items.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary mt-0.5">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </ScrollArea>
  )
}
