import { filterLibraryPlayers, libraryDisplayName, randomId, type LibraryPlayer } from '@jamez/core'
import { UserPlusIcon } from 'lucide-react'
import * as React from 'react'
import { EmojiPicker } from '@/components/emoji-picker'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePlayerRoster } from '@/lib/player-roster'
import { randomEmoji } from '@/lib/profile'
import { useSession } from '@/lib/session-store'

export function AddLocalPlayerDialog({
  triggerLabel = 'Add player',
  title = 'Add a player',
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
  showTrigger?: boolean
  onAdded?: (player: { id: string; name: string; emoji: string; photo?: string }) => void
}) {
  const addLocalPlayer = useSession((s) => s.addLocalPlayer)
  const players = useSession((s) => s.state?.players)
  const entries = usePlayerRoster((s) => s.entries)
  const seated = players?.map((p) => p.id) ?? []
  const [query, setQuery] = React.useState('')
  const available = React.useMemo(
    () => filterLibraryPlayers(entries, query, { seatedIds: seated }),
    [entries, query, seated],
  )
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [name, setName] = React.useState('')
  const [emoji, setEmoji] = React.useState(randomEmoji())
  const [tab, setTab] = React.useState<'library' | 'new'>('library')

  React.useEffect(() => {
    if (!open) return
    setTab(entries.some((entry) => !entry.inactive) ? 'library' : 'new')
    setQuery('')
  }, [open, entries])

  const resetForm = () => {
    setName('')
    setEmoji(randomEmoji())
    setQuery('')
  }

  const close = () => {
    setOpen(false)
    resetForm()
  }

  const finish = (profile: { id: string; name: string; emoji: string; photo?: string; clientIds?: string[] }) => {
    addLocalPlayer(profile)
    onAdded?.(profile)
    close()
  }

  const addNew = () => {
    if (!name.trim()) return
    finish({ id: randomId(8), name: name.trim(), emoji, clientIds: [] })
  }

  const pick = (player: LibraryPlayer) => {
    finish({
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      clientIds: player.clientIds,
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
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'library' | 'new')}>
          <TabsList>
            <TabsTrigger value="library">Players</TabsTrigger>
            <TabsTrigger value="new">Create new</TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="grid gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search players"
              aria-label="Search players"
            />
            {available.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No matching players. Create a new one, or show inactive players on the Players screen.
              </p>
            ) : (
              <div className="grid max-h-52 gap-1.5 overflow-y-auto">
                {available.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => pick(player)}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {player.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {libraryDisplayName(player)}
                    </span>
                    {player.alias ? (
                      <span className="truncate text-xs text-muted-foreground">{player.name}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="new" className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-player-name">Name</Label>
              <Input
                id="add-player-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={namePlaceholder}
                maxLength={24}
                autoFocus={tab === 'new'}
                enterKeyHint="done"
                onKeyDown={(event) => event.key === 'Enter' && addNew()}
              />
            </div>
            <div className="grid gap-2">
              <Label>Emoji</Label>
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>
            <DialogFooter className="p-0 sm:justify-stretch">
              <Button className="w-full" onClick={addNew} disabled={!name.trim()}>
                {confirmLabel}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
