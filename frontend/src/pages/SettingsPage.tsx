import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Save, User as UserIcon, Upload, X } from "lucide-react"
import { getAvatarColor, getInitials } from "@/lib/user"
import { api } from "@/lib/api"

export function SettingsPage() {
  const { user, login } = useAuth()
  
  // Local state for the form
  const [name, setName] = useState(user?.name || "")
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || "")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ type: "", text: "" })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setAvatarFile(file)
      // Create a local preview URL
      setAvatarUrl(URL.createObjectURL(file))
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarUrl("")
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage({ type: "", text: "" })

    try {
      if (avatarFile) {
        const formData = new FormData()
        formData.append("file", avatarFile)
        
        await api.post("/users/me/avatar", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
      }

      await api.patch("/users/me", { name })
      
      // Simulate context refresh since we don't have a real context updater here,
      // but in real app `login()` or `fetchUser()` should just be called.
      // We'll rely on a page reload or context refresh later if needed.
      
      setMessage({ type: "success", text: "Profile updated successfully." })
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update profile." })
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50 p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Not Signed In</h2>
          <p className="text-slate-500 mb-4">You need to be signed in to view settings.</p>
          <Button onClick={login}>Sign In</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50">
      <main className="max-w-3xl mx-auto p-6 md:p-8">
        <div className="mb-8 pb-4 border-b border-slate-200">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your account settings and preferences.</p>
        </div>

        <div className="grid gap-8">
          <Card>
            <form onSubmit={handleSave}>
              <CardHeader>
                <CardTitle>Profile Details</CardTitle>
                <CardDescription>
                  Update your personal information.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Avatar Preview */}
                <div className="flex items-center gap-6">
                  <Avatar className="size-20 border shadow-sm">
                    <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
                    <AvatarFallback className={`text-lg ${getAvatarColor(name || user.id)}`}>
                      {name ? getInitials(name) : <UserIcon className="size-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-3 flex-1">
                    <Label>Profile Picture</Label>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="avatar-upload" className="cursor-pointer">
                        <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white shadow-sm hover:bg-slate-100 hover:text-slate-900 h-9 px-4 py-2 gap-2">
                          <Upload className="size-4" />
                          Upload Image
                        </div>
                      </Label>
                      <input 
                        id="avatar-upload" 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      {avatarUrl && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={handleRemoveAvatar}
                        >
                          <X className="size-4 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Supported formats: JPG, PNG, GIF. Max size 5MB.</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input 
                      id="name" 
                      placeholder="Your name" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      value={user.email} 
                      disabled 
                      className="bg-slate-50 text-slate-500"
                    />
                    <p className="text-xs text-slate-500">Your email address is managed by your identity provider.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 uppercase tracking-wider">
                        {user.role}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between border-t bg-slate-50/50 px-6 py-4">
                <div className="text-sm">
                  {message.text && (
                    <span className={message.type === "success" ? "text-emerald-600" : "text-red-600"}>
                      {message.text}
                    </span>
                  )}
                </div>
                <Button type="submit" disabled={isSaving || !name.trim()}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 size-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  )
}
