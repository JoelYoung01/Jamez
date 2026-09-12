import { randomId, rosterAvailableForSession, type RosterPlayer } from '@jamez/core'
import { UserPlusIcon } from 'lucide-react'
import * as React from 'react'
import { EmojiPicker } from '@/components/emoji-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePlayerRoster } from '@/lib/player-roster'
import { randomEmoji } from '@/lib/profile'
import { useSession } from '@/lib/session-store'

export type AddLocalPlayerProfile = {
  name: string
  emoji: string
  id?: string
  photo?: string
}

export function AddLocalPlayerDialog({
  triggerLabel = 'Add local player',
  title = 'Add a local player',
  confirmLabel = 'Add player',
  namePlaceholder = 'e.g. Grandma',
  open: openProp,
  onOpenChange,
  keyboardAvoid = false,
  showTrigger = true,
  onAdded,
}: {
  triggerLabel?: string
  title?: string
  confirmLabel?: string
  namePlaceholder?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  keyboardAvoid?: boolean
  /** When false, render dialog chrome only (nested / controlled use). */
  showTrigger?: boolean
  /** Called after a successful add with the seated player id. */
  onAdded?: (player: { id: string; name: string; emoji: string; photo?: string }) => void
}) {
  const addLocalPlayer = useSession((s) => s.addLocalPlayer)
  const players = useSession((s) => s.state?.players)
  const entries = usePlayerRoster((s) => s.entries)
  const available = React.useMemo(
    () => rosterAvailableForSession(entries, players?.map((p) => p.id) ?? []),
    [entries, players],
  )
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [name, setName] = React.useState('')
  const [emoji, setEmoji] = React.useState(randomEmoji())

  const resetForm = () => {
    setName('')
    setEmoji(randomEmoji())
  }

  const close = () => {
    setOpen(false)
    resetForm()
  }

  const finish = (profile: { id: string; name: string; emoji: string; photo?: string }) => {
    addLocalPlayer(profile)
    onAdded?.(profile)
    close()
  }

  const addNew = () => {
    if (!name.trim()) return
    finish({ id: randomId(8), name: name.trim(), emoji })
  }

  const pickRecent = (player: RosterPlayer) => {
    finish({
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      ...(player.photo ? { photo: player.photo } : {}),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <UserPlusIcon /> {triggerLabel}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent keyboardAvoid={keyboardAvoid}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {available.length > 0 && (
            <div className="grid gap-2">
              <Label>Recent players</Label>
              <div className="grid max-h-40 gap-1.5 overflow-y-auto">
                {available.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => pickRecent(player)}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {player.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {player.source}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="add-local-name">
              {available.length > 0 ? 'Create new' : 'Name'}
            </Label>
            <Input
              id="add-local-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePlaceholder}
              maxLength={24}
              autoFocus={available.length === 0}
              enterKeyHint="done"
              onKeyDown={(e) => e.key === 'Enter' && addNew()}
            />
          </div>
          <div className="grid gap-2">
            <Label>Emoji</Label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={addNew} disabled={!name.trim()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
