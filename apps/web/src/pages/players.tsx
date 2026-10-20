import {
  EnrollHost,
  createNostrTransport,
  generateJoinCode,
  libraryDisplayName,
  libraryPlayerByClientId,
  randomId,
} from '@jamez/core'
import { SmartphoneIcon, UserPlusIcon } from 'lucide-react'
import * as React from 'react'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import { EmojiPicker } from '@/components/emoji-picker'
import { MergeDialog } from '@/components/player-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePlayerRoster } from '@/lib/player-roster'
import { currentProfile, randomEmoji } from '@/lib/profile'
import { activeRelays } from '@/lib/settings'

export function enrollUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}enroll/${code}`
}

export function PlayersPage() {
  const entries = usePlayerRoster((s) => s.entries)
  const upsert = usePlayerRoster((s) => s.upsert)
  const setInactive = usePlayerRoster((s) => s.setInactive)
  const setAlias = usePlayerRoster((s) => s.setAlias)
  const [query, setQuery] = React.useState('')
  const [showInactive, setShowInactive] = React.useState(false)
  const [enrollCode, setEnrollCode] = React.useState<string | null>(null)
  const [mergeId, setMergeId] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState('')
  const [emoji, setEmoji] = React.useState(randomEmoji())

  React.useEffect(() => {
    if (!enrollCode) return
    const host = new EnrollHost({
      code: enrollCode,
      hostId: currentProfile().id,
      transport: createNostrTransport({ code: enrollCode, relays: activeRelays() }),
      onEnroll(player) {
        const existing = libraryPlayerByClientId(usePlayerRoster.getState().entries, player.id)
        if (existing) {
          upsert({
            id: existing.id,
            name: player.name,
            emoji: player.emoji,
            clientIds: [...new Set([...existing.clientIds, player.id])],
            fromClient: true,
            inactive: false,
            ...(player.photo ? { photo: player.photo } : {}),
          })
          toast(`${player.name} updated`)
          return 'updated'
        }
        upsert({
          id: player.id,
          name: player.name,
          emoji: player.emoji,
          clientIds: [player.id],
          fromClient: true,
          inactive: false,
          ...(player.photo ? { photo: player.photo } : {}),
        })
        toast(`${player.name} added`)
        return 'added'
      },
    })
    host.start()
    return () => host.stop()
  }, [enrollCode, upsert])

  const visible = entries.filter((entry) => {
    if (!showInactive && entry.inactive) return false
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return `${libraryDisplayName(entry)} ${entry.name}`.toLowerCase().includes(needle)
  })

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Players</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <UserPlusIcon /> Add player
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add someone with their phone</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            The code works only while this section is open. A scan saves them into this library.
          </p>
          {enrollCode ? (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl bg-white p-4">
                <QRCode value={enrollUrl(enrollCode)} size={176} />
              </div>
              <div className="font-mono text-2xl font-bold tracking-[0.3em] text-primary">{enrollCode}</div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setEnrollCode(generateJoinCode())}>
              Show QR
            </Button>
          )}
          {enrollCode ? (
            <Button variant="ghost" onClick={() => setEnrollCode(null)}>
              Hide QR
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search players"
          aria-label="Search players"
        />
        <Button variant={showInactive ? 'secondary' : 'outline'} onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? 'Showing inactive' : 'Active only'}
        </Button>
      </div>
      <div className="grid gap-2">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No players yet.</p>
        ) : (
          visible.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <span className="text-xl">{entry.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{libraryDisplayName(entry)}</span>
                    {entry.clientIds.length > 0 ? (
                      <SmartphoneIcon className="size-3.5 text-muted-foreground" aria-label="Has a phone" />
                    ) : null}
                  </div>
                  {entry.alias ? (
                    <div className="truncate text-xs text-muted-foreground">{entry.name}</div>
                  ) : null}
                </div>
                <Button size="sm" variant="outline" onClick={() => setMergeId(entry.id)}>
                  Merge
                </Button>
                {entry.clientIds.length > 0 ? (
                  <AliasButton id={entry.id} alias={entry.alias ?? ''} onSave={setAlias} />
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setInactive(entry.id, !entry.inactive)}>
                  {entry.inactive ? 'Activate' : 'Make inactive'}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <MergeDialog open={mergeId !== null} sourceId={mergeId} onOpenChange={(open) => !open && setMergeId(null)} />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New player</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="new-player-name">Name</Label>
              <Input id="new-player-name" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
            </div>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
          <DialogFooter>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                upsert({
                  id: randomId(8),
                  name: name.trim(),
                  emoji,
                  clientIds: [],
                })
                setName('')
                setEmoji(randomEmoji())
                setCreating(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AliasButton({
  id,
  alias,
  onSave,
}: {
  id: string
  alias: string
  onSave: (id: string, alias: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(alias)
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDraft(alias)
          setOpen(true)
        }}
      >
        Alias
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alias</DialogTitle>
          </DialogHeader>
          <Input value={draft} maxLength={24} onChange={(event) => setDraft(event.target.value)} />
          <DialogFooter>
            <Button
              onClick={() => {
                onSave(id, draft)
                setOpen(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
