import {
  getGameEngine,
  hasPhoneClient,
  isOngoingGame,
  libraryDisplayName,
  type LibraryMergeChoices,
  type LibraryPlayer,
  type PlayerMergeMode,
  type SessionPlayer,
} from '@jamez/core'
import { SmartphoneIcon } from 'lucide-react'
import * as React from 'react'
import { EmojiPicker } from '@/components/emoji-picker'
import { Button } from '@/components/ui/button'
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
import { useSession } from '@/lib/session-store'
import { cn } from '@/lib/utils'

export function hostFacingName(player: { id: string; name: string }, entries: LibraryPlayer[]): string {
  const entry = entries.find((item) => item.id === player.id)
  return entry ? libraryDisplayName(entry) : player.name
}

export function HostPlayerMenu({
  player,
  children,
  className,
}: {
  player: SessionPlayer
  children: React.ReactNode
  className?: string
}) {
  const role = useSession((s) => s.role)
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const [dialog, setDialog] = React.useState<'merge' | 'kick' | 'edit' | null>(null)
  if (role !== 'host' || player.isHost) {
    return <div className={className}>{children}</div>
  }
  return (
    <div
      className={className}
      title="Right-click for player actions"
      onContextMenu={(event) => {
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      {children}
      {menu ? (
        <PlayerMenuPopover
          player={player}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onPick={(next) => {
            setMenu(null)
            if (next !== 'presence') setDialog(next)
          }}
        />
      ) : null}
      <MergeDialog
        open={dialog === 'merge'}
        sourceId={player.id}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <KickDialog
        open={dialog === 'kick'}
        player={player}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <EditDialog
        open={dialog === 'edit'}
        player={player}
        onOpenChange={(open) => !open && setDialog(null)}
      />
    </div>
  )
}

function PlayerMenuPopover({
  player,
  x,
  y,
  onClose,
  onPick,
}: {
  player: SessionPlayer
  x: number
  y: number
  onClose: () => void
  onPick: (action: 'merge' | 'kick' | 'edit' | 'presence') => void
}) {
  const state = useSession((s) => s.state)
  const remove = useSession((s) => s.removePlayer)
  const deactivate = useSession((s) => s.deactivatePlayer)
  const reactivate = useSession((s) => s.reactivatePlayer)
  const ongoing = state ? isOngoingGame(getGameEngine(state.gameId) ?? { sessionMode: 'match' }) : false
  const atTable = player.active !== false
  React.useEffect(() => {
    const close = () => onClose()
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [onClose])
  const item =
    'block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent'
  return (
    <div
      className="fixed z-50 w-52 rounded-xl border border-border bg-card p-1 shadow-lg"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className={item} onClick={() => onPick('merge')}>
        Merge with…
      </button>
      {hasPhoneClient(player) ? (
        <button type="button" className={item} onClick={() => onPick('kick')}>
          Kick
        </button>
      ) : (
        <button
          type="button"
          className={item}
          onClick={() => {
            remove(player.id)
            onClose()
          }}
        >
          Remove from game
        </button>
      )}
      <button type="button" className={item} onClick={() => onPick('edit')}>
        {hasPhoneClient(player) ? 'Set alias' : 'Edit'}
      </button>
      {ongoing ? (
        <button
          type="button"
          className={item}
          onClick={() => {
            if (atTable) deactivate(player.id)
            else reactivate(player.id)
            onClose()
          }}
        >
          {atTable ? 'Not present' : 'At the table'}
        </button>
      ) : null}
    </div>
  )
}

function FieldChoice({
  label,
  value,
  onChange,
  fromLabel,
  toLabel,
}: {
  label: string
  value: 'from' | 'to'
  onChange: (value: 'from' | 'to') => void
  fromLabel: string
  toLabel: string
}) {
  return (
    <div className="grid gap-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          className={cn(
            'truncate rounded-md border px-2 py-1 text-left text-xs',
            value === 'to' ? 'border-primary bg-primary/10' : 'border-border',
          )}
          onClick={() => onChange('to')}
        >
          {toLabel}
        </button>
        <button
          type="button"
          className={cn(
            'truncate rounded-md border px-2 py-1 text-left text-xs',
            value === 'from' ? 'border-primary bg-primary/10' : 'border-border',
          )}
          onClick={() => onChange('from')}
        >
          {fromLabel}
        </button>
      </div>
    </div>
  )
}

export function MergeDialog({
  open,
  sourceId,
  onOpenChange,
}: {
  open: boolean
  sourceId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const entries = usePlayerRoster((s) => s.entries)
  const mergeLibrary = usePlayerRoster((s) => s.merge)
  const state = useSession((s) => s.state)
  const mergeSeats = useSession((s) => s.mergePlayers)
  const others = entries.filter((entry) => entry.id !== sourceId)
  const [otherId, setOtherId] = React.useState('')
  const [survivor, setSurvivor] = React.useState<'source' | 'other'>('other')
  const [choices, setChoices] = React.useState<Required<LibraryMergeChoices>>({
    name: 'to',
    emoji: 'to',
    photo: 'to',
    alias: 'to',
  })
  const [mode, setMode] = React.useState<PlayerMergeMode>('combine')

  React.useEffect(() => {
    if (!open) return
    setOtherId(others[0]?.id ?? '')
    setSurvivor('other')
    setChoices({ name: 'to', emoji: 'to', photo: 'to', alias: 'to' })
    setMode('combine')
  }, [open, sourceId])

  const source = entries.find((entry) => entry.id === sourceId)
  const other = entries.find((entry) => entry.id === otherId)
  const from = survivor === 'source' ? other : source
  const to = survivor === 'source' ? source : other
  const bothSeated = Boolean(
    state && from && to && state.players.some((p) => p.id === from.id) && state.players.some((p) => p.id === to.id),
  )
  const engine = state ? getGameEngine(state.gameId) : undefined
  const scoreNote = !bothSeated
    ? 'Neither seat is in the open room, so only the library changes.'
    : engine?.mergePlayers
      ? mode === 'combine'
        ? 'Scores in the open game are added onto the survivor.'
        : 'The survivor’s score stays. The other score is dropped.'
      : 'This game keeps the survivor’s score either way.'

  const confirm = () => {
    if (!from || !to) return
    if (bothSeated) {
      const name = choices.name === 'from' ? from.name : to.name
      const emoji = choices.emoji === 'from' ? from.emoji : to.emoji
      const photo = choices.photo === 'from' ? from.photo : to.photo
      const seated = mergeSeats(from.id, to.id, mode, { name, emoji, ...(photo ? { photo } : {}) })
      if (!seated) return
    }
    const error = mergeLibrary(from.id, to.id, choices)
    if (error) return
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge players</DialogTitle>
        </DialogHeader>
        {!source ? (
          <p className="text-sm text-muted-foreground">That player is not in the library yet.</p>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Merge with</Label>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={otherId}
                onChange={(event) => setOtherId(event.target.value)}
              >
                {others.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {libraryDisplayName(entry)}
                  </option>
                ))}
              </select>
            </div>
            {other ? (
              <>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs',
                      survivor === 'other' ? 'border-primary' : 'border-border',
                    )}
                    onClick={() => setSurvivor('other')}
                  >
                    Keep {libraryDisplayName(other)}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs',
                      survivor === 'source' ? 'border-primary' : 'border-border',
                    )}
                    onClick={() => setSurvivor('source')}
                  >
                    Keep {libraryDisplayName(source)}
                  </button>
                </div>
                <FieldChoice
                  label="Name"
                  value={choices.name}
                  fromLabel={from?.name ?? ''}
                  toLabel={to?.name ?? ''}
                  onChange={(name) => setChoices((c) => ({ ...c, name }))}
                />
                <FieldChoice
                  label="Emoji"
                  value={choices.emoji}
                  fromLabel={from?.emoji ?? ''}
                  toLabel={to?.emoji ?? ''}
                  onChange={(emoji) => setChoices((c) => ({ ...c, emoji }))}
                />
                <FieldChoice
                  label="Alias"
                  value={choices.alias}
                  fromLabel={from?.alias || 'None'}
                  toLabel={to?.alias || 'None'}
                  onChange={(alias) => setChoices((c) => ({ ...c, alias }))}
                />
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs',
                      mode === 'combine' ? 'border-primary' : 'border-border',
                    )}
                    onClick={() => setMode('combine')}
                  >
                    Combine scores
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs',
                      mode === 'keep' ? 'border-primary' : 'border-border',
                    )}
                    onClick={() => setMode('keep')}
                  >
                    Keep survivor score
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Both phones stay attached to the survivor. {scoreNote}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Add another player before merging.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={confirm} disabled={!from || !to}>
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KickDialog({
  open,
  player,
  onOpenChange,
}: {
  open: boolean
  player: SessionPlayer
  onOpenChange: (open: boolean) => void
}) {
  const kick = useSession((s) => s.kickPlayer)
  const remove = useSession((s) => s.removePlayer)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kick {player.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Their phone leaves this session. They can scan the join code again later.
        </p>
        <DialogFooter className="gap-2 sm:justify-stretch">
          <Button
            variant="secondary"
            onClick={() => {
              kick(player.id)
              onOpenChange(false)
            }}
          >
            Keep at the table
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              remove(player.id)
              onOpenChange(false)
            }}
          >
            Remove from game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({
  open,
  player,
  onOpenChange,
}: {
  open: boolean
  player: SessionPlayer
  onOpenChange: (open: boolean) => void
}) {
  const entries = usePlayerRoster((s) => s.entries)
  const entry = entries.find((item) => item.id === player.id)
  const setAlias = usePlayerRoster((s) => s.setAlias)
  const update = useSession((s) => s.updateLocalPlayer)
  const phone = hasPhoneClient(player)
  const [name, setName] = React.useState(player.name)
  const [emoji, setEmoji] = React.useState(player.emoji)
  const [alias, setAliasDraft] = React.useState(entry?.alias ?? '')
  React.useEffect(() => {
    if (!open) return
    setName(player.name)
    setEmoji(player.emoji)
    setAliasDraft(entry?.alias ?? '')
  }, [open, player.name, player.emoji, entry?.alias])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{phone ? `Alias for ${player.name}` : `Edit ${player.name}`}</DialogTitle>
        </DialogHeader>
        {phone ? (
          <div className="grid gap-2">
            <Label htmlFor="player-alias">Alias</Label>
            <Input
              id="player-alias"
              value={alias}
              maxLength={24}
              placeholder="Only you see this"
              onChange={(event) => setAliasDraft(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Their phone still shows {player.name}. A later join refreshes that name.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="player-name">Name</Label>
              <Input id="player-name" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
            </div>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
        )}
        <DialogFooter>
          <Button
            onClick={() => {
              if (phone) setAlias(player.id, alias)
              else update(player.id, { name: name.trim(), emoji })
              onOpenChange(false)
            }}
            disabled={!phone && !name.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PhoneMark({ player }: { player: Pick<SessionPlayer, 'clientIds' | 'isHost'> }) {
  if (!hasPhoneClient(player)) return null
  return <SmartphoneIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Has a phone" />
}
