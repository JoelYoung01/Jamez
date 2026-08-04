import * as React from 'react'
import { EmojiPicker } from '@/components/emoji-picker'
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
  const { name, emoji, setName, setEmoji } = useProfile()
  const [open, setOpen] = React.useState(false)
  const [draftName, setDraftName] = React.useState(name)
  const [draftEmoji, setDraftEmoji] = React.useState(emoji)

  React.useEffect(() => {
    if (open) {
      setDraftName(name)
      setDraftEmoji(emoji)
    }
  }, [open, name, emoji])

  const save = () => {
    setName(draftName)
    setEmoji(draftEmoji)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your profile</DialogTitle>
          <DialogDescription>
            Stored only on this device. Friends see this name and emoji when you join their games.
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
            <Label>Emoji</Label>
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
