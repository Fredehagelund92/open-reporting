import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react"

export function InviteUserDialog({ spaceId, spaceName }: { spaceId: string, spaceName: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setResult(null)

    try {
      // In a real app we'd call the API:
      // await api.post(`/api/v1/spaces/${spaceId}/invite`, { user_email: email })
      
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setResult({ type: 'success', message: `${email} has been invited!` })
      setEmail("") // clear form for next invite
      
    } catch (err: any) {
       setResult({ 
         type: 'error', 
         message: err?.response?.data?.detail || "Failed to invite user. Check if the email is correct." 
       })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Clear result when reopening
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) setResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-9 px-4 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
        >
          <UserPlus className="size-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleInvite}>
          <DialogHeader>
            <DialogTitle>Invite to {spaceName}</DialogTitle>
            <DialogDescription>
              Grant a user access to view and post in this private space.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-6">
            {result && (
              <div className={`p-3 text-sm rounded-md flex items-center gap-2 ${
                result.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {result.type === 'success' && <CheckCircle2 className="size-4" />}
                {result.message}
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="email">User Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                The user must already have registered an account to be invited.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={isSubmitting || !email.trim()}>
              {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
