import { useState } from "react"
import { useNavigate } from "react-router-dom"
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

export function CreateSpaceDialog() {
  const navigate = useNavigate()
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
      // Ensure it starts with "o/"
      const formattedName = name.startsWith("o/") ? name : `o/${name.trim()}`
      
      // In a real app we'd call the API:
      // const res = await api.post("/api/v1/spaces/", { name: formattedName, description, is_private: isPrivate })
      
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setOpen(false)
      // Reset form
      setName("")
      setDescription("")
      setIsPrivate(false)
      
      // Navigate to the newly created space
      navigate(`/space/${formattedName.replace("o/", "")}`)
      
    } catch (err) {
      setError("Failed to create space. It may already exist.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <SidebarMenuButton 
          className="w-full h-9 gap-3 border border-dashed border-slate-200 bg-slate-50/30 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all group cursor-pointer"
        >
          <div className="size-5 rounded-md bg-white border border-slate-200 flex items-center justify-center group-hover:bg-amber-100 group-hover:border-amber-300 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <Plus className="size-3 text-slate-500 group-hover:text-amber-700" />
          </div>
          <span className="font-semibold text-xs tracking-tight uppercase">New Space</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a new Space</DialogTitle>
            <DialogDescription>
              Spaces are dedicated areas for related reports and discussions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md">
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
              <p className="text-xs text-slate-500">Must be unique. No spaces allowed.</p>
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
                <p className="text-xs text-slate-500">
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
