import * as React from 'react'
import { EmojiPicker } from '@/components/emoji-picker'
import { ProfilePhotoPicker } from '@/components/profile-photo-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile } from '@/lib/profile'

export function ProfileDialog({ children }: { children: React.ReactNode }) {
  const { name, emoji, photo, setName, setEmoji, setPhoto } = useProfile()
  const [open, setOpen] = React.useState(false)
  const [draftName, setDraftName] = React.useState(name)
  const [draftEmoji, setDraftEmoji] = React.useState(emoji)
  const [draftPhoto, setDraftPhoto] = React.useState<string | undefined>(photo)

  React.useEffect(() => {
    if (open) {
      setDraftName(name)
      setDraftEmoji(emoji)
      setDraftPhoto(photo)
    }
  }, [open, name, emoji, photo])

  const save = () => {
    setName(draftName)
    setEmoji(draftEmoji)
    setPhoto(draftPhoto)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your profile</DialogTitle>
          <DialogDescription>
            Stored only on this device. Friends see this name, emoji, and photo when you join their
            games.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="e.g. Robin"
              maxLength={24}
            />
          </div>
          <div className="grid gap-2">
            <Label>Photo</Label>
            <ProfilePhotoPicker emoji={draftEmoji} photo={draftPhoto} onChange={setDraftPhoto} />
            <p className="text-xs text-muted-foreground">
              Optional. Shrunk to a tiny thumbnail so it can sync over the table connection.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Emoji{draftPhoto ? ' (fallback)' : ''}</Label>
            <EmojiPicker value={draftEmoji} onChange={setDraftEmoji} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={draftName.trim().length === 0}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
