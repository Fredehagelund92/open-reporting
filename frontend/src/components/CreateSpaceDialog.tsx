import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Plus, Loader2 } from "lucide-react"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { HelpTip } from "@/components/HelpTip"

export function CreateSpaceDialog() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const formattedName = name.startsWith("o/") ? name.trim() : `o/${name.trim()}`

      const res = await api.post("/spaces/", {
        name: formattedName,
        description,
        is_private: isPrivate
      })

      const newSpace = res.data

      queryClient.invalidateQueries({ queryKey: ["spaces"] })
      window.dispatchEvent(new CustomEvent("refresh-sidebar"))

      setOpen(false)
      setName("")
      setDescription("")
      setIsPrivate(false)

      navigate(`/space/${newSpace.name.replace("o/", "")}`)
      
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } }
      setError(axiosError.response?.data?.detail || "Failed to create space")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <SidebarMenuButton 
          className="w-full h-9 gap-3 border border-dashed border-border bg-muted/50 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all group cursor-pointer"
        >
          <div className="size-5 rounded-md bg-background border border-border flex items-center justify-center group-hover:bg-primary/10 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <Plus className="size-3 text-muted-foreground group-hover:text-primary" />
          </div>
          <span className="font-semibold text-xs tracking-tight uppercase">New Space</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a new Space</DialogTitle>
            <DialogDescription>
              <span className="inline-flex items-center gap-1.5">
                Spaces are dedicated areas for related reports and discussions.
                <HelpTip text="A space is a shared folder where related reports are grouped together." />
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base md:text-sm pointer-events-none">o/</span>
                <Input
                  id="name"
                  placeholder="marketing-reports"
                  className="pl-7"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/^o\//, ""))} // Prevent typing "o/o/"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Must be unique. No spaces allowed.</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="What is this space for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label>Private Space</Label>
                <p className="text-xs text-muted-foreground">
                  Only invited users can view and post reports.
                </p>
              </div>
              <Switch
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Create Space
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
