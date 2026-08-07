import {
  chipBreakdown,
  formatPokerAmount,
  getGameEngine,
  pointsFromChipCounts,
  toPoints,
  type PokerBankConfig,
  type PokerBankState,
  type PokerChipDenom,
  type PokerCurrencyMode,
  type SessionPlayer,
} from '@jamez/core'
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CoinsIcon,
  DollarSignIcon,
  GitMergeIcon,
  Settings2Icon,
  UserPlusIcon,
  UserRoundCheckIcon,
} from 'lucide-react'
import * as React from 'react'
import { ColorPicker } from '@/components/color-picker'
import { EmojiPicker } from '@/components/emoji-picker'
import { PokerChip } from '@/components/poker-chip'
import { PlayerAvatar } from '@/components/player-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Segmented } from '@/components/ui/segmented'
import { randomEmoji } from '@/lib/profile'
import { useSession } from '@/lib/session-store'
import { cn } from '@/lib/utils'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

function GuestProfileFields({
  nameId,
  name,
  emoji,
  onNameChange,
  onEmojiChange,
  onSubmit,
}: {
  nameId: string
  name: string
  emoji: string
  onNameChange: (name: string) => void
  onEmojiChange: (emoji: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Cousin Mike"
          maxLength={24}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
      </div>
      <div className="grid gap-2">
        <Label>Emoji</Label>
        <EmojiPicker value={emoji} onChange={onEmojiChange} />
      </div>
    </div>
  )
}

function AddGuestButton() {
  const addLocalPlayer = useSession((s) => s.addLocalPlayer)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [emoji, setEmoji] = React.useState(randomEmoji())

  const add = () => {
    if (!name.trim()) return
    addLocalPlayer({ name: name.trim(), emoji })
    setName('')
    setEmoji(randomEmoji())
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlusIcon /> Add guest
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a guest seat</DialogTitle>
        </DialogHeader>
        <GuestProfileFields
          nameId="guest-name"
          name={name}
          emoji={emoji}
          onNameChange={setName}
          onEmojiChange={setEmoji}
          onSubmit={add}
        />
        <DialogFooter>
          <Button onClick={add} disabled={!name.trim()}>
            Add guest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Host taps a guest card to rename / re-emoji the seat. */
function EditGuestDialog({
  player,
  children,
}: {
  player: SessionPlayer
  children: React.ReactNode
}) {
  const updateLocalPlayer = useSession((s) => s.updateLocalPlayer)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState(player.name)
  const [emoji, setEmoji] = React.useState(player.emoji)

  React.useEffect(() => {
    if (open) {
      setName(player.name)
      setEmoji(player.emoji)
    }
  }, [open, player.name, player.emoji])

  const save = () => {
    if (!name.trim()) return
    updateLocalPlayer(player.id, { name: name.trim(), emoji })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit guest</DialogTitle>
        </DialogHeader>
        <GuestProfileFields
          nameId={`edit-guest-${player.id}`}
          name={name}
          emoji={emoji}
          onNameChange={setName}
          onEmojiChange={setEmoji}
          onSubmit={save}
        />
        <DialogFooter>
          <Button onClick={save} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Allow typing partial decimals (e.g. clear → "0.25"); coerce on blur. */
function parsePointsPerDollar(raw: string): number {
  const n = Number.parseFloat(raw.trim())
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.min(1_000_000, n)
}

function PointsPerDollarField({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (next: number) => void
  className?: string
}) {
  const [text, setText] = React.useState(String(value))

  React.useEffect(() => {
    setText(String(value))
  }, [value])

  const commit = () => {
    const next = parsePointsPerDollar(text)
    onChange(next)
    setText(String(next))
  }

  return (
    <Input
      inputMode="decimal"
      className={cn('h-9 font-mono tabular-nums', className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value
        setText(t)
        const n = Number.parseFloat(t.trim())
        if (Number.isFinite(n) && n > 0) onChange(Math.min(1_000_000, n))
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
    />
  )
}

/** Integer chip value — draft while typing; coerce to ≥1 on blur. */
function ChipValueField({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (next: number) => void
  className?: string
}) {
  const [text, setText] = React.useState(String(value))

  React.useEffect(() => {
    setText(String(value))
  }, [value])

  const commit = () => {
    const n = Number.parseInt(text.replace(/\D/g, ''), 10)
    const next = Number.isNaN(n) ? 1 : Math.max(1, n)
    onChange(next)
    setText(String(next))
  }

  return (
    <Input
      inputMode="numeric"
      className={cn('h-8 font-mono tabular-nums', className)}
      value={text}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/\D/g, '')
        setText(cleaned)
        const n = Number.parseInt(cleaned, 10)
        if (!Number.isNaN(n) && n >= 1) onChange(n)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
    />
  )
}

function PokerSetup({ config, onChange }: GameSetupProps<PokerBankConfig>) {
  const set = (patch: Partial<PokerBankConfig>) => onChange({ ...config, ...patch })

  const updateChip = (index: number, patch: Partial<PokerChipDenom>) => {
    const chips = config.chips.map((c, i) => (i === index ? { ...c, ...patch } : c))
    set({ chips })
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Starting stack (points)</Label>
          <Input
            inputMode="numeric"
            className="h-9 font-mono tabular-nums"
            value={String(config.startingStack)}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value.replace(/\D/g, ''), 10)
              set({ startingStack: Number.isNaN(n) ? 0 : Math.min(1_000_000, n) })
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Display as</Label>
          <Segmented
            value={config.currencyMode}
            onChange={(currencyMode) => set({ currencyMode: currencyMode as PokerCurrencyMode })}
            options={[
              { value: 'points', label: 'Points' },
              { value: 'dollars', label: 'Dollars' },
            ]}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Points per dollar</Label>
        <PointsPerDollarField
          value={config.pointsPerDollar}
          onChange={(pointsPerDollar) => set({ pointsPerDollar })}
        />
        <p className="text-[11px] text-muted-foreground">
          Cash-in amounts can be entered in either unit; chip math always uses points.
        </p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Chip denominations</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set({
                chips: [
                  ...config.chips,
                  {
                    id: `chip-${config.chips.length + 1}`,
                    label: 'New',
                    value: 1,
                    color: '#a1a1aa',
                  },
                ],
              })
            }
          >
            Add chip
          </Button>
        </div>
        <div className="grid gap-2">
          {config.chips.map((chip, index) => (
            <div
              key={chip.id}
              className="grid grid-cols-[auto_1fr_1fr_6.5rem_auto] items-center gap-2 rounded-lg border border-border/60 px-2 py-2"
            >
              <PokerChip color={chip.color} size={32} label={String(chip.value)} />
              <Input
                value={chip.label}
                onChange={(e) => updateChip(index, { label: e.target.value.slice(0, 16) })}
                className="h-8"
                placeholder="Label"
              />
              <ChipValueField
                value={chip.value}
                onChange={(value) => updateChip(index, { value })}
              />
              <ColorPicker
                value={chip.color}
                onChange={(color) => updateChip(index, { color })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={config.chips.length <= 1}
                onClick={() => set({ chips: config.chips.filter((_, i) => i !== index) })}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type CashInputMode = PokerCurrencyMode | 'chips'

function parseChipCountDrafts(
  drafts: Record<string, string>,
  chips: PokerChipDenom[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const chip of chips) {
    const n = Number.parseInt(drafts[chip.id] ?? '', 10)
    if (!Number.isNaN(n) && n > 0) counts[chip.id] = n
  }
  return counts
}

function CashDialog({
  mode,
  player,
  game,
  send,
}: {
  mode: 'deposit' | 'withdraw'
  player: SessionPlayer
  game: PokerBankState
  send: GamePlayProps['send']
}) {
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [unit, setUnit] = React.useState<CashInputMode>(game.config.currencyMode)
  const [chipDrafts, setChipDrafts] = React.useState<Record<string, string>>({})
  const numeric = Number.parseFloat(amount)
  const chipPoints = pointsFromChipCounts(
    parseChipCountDrafts(chipDrafts, game.config.chips),
    game.config.chips,
  )
  const points =
    unit === 'chips'
      ? chipPoints
      : Number.isFinite(numeric) && numeric > 0
        ? toPoints(numeric, unit, game.config.pointsPerDollar)
        : 0
  const breakdown =
    mode === 'withdraw' && unit !== 'chips' ? chipBreakdown(points, game.config.chips) : []
  const balance = game.banks[player.id]?.balance ?? 0

  React.useEffect(() => {
    if (!open) return
    setAmount('')
    setUnit(game.config.currencyMode)
    setChipDrafts({})
  }, [open, game.config.currencyMode])

  const submit = () => {
    if (!(points > 0)) return
    // Host acts as host (isHost); guests always act as themselves via the store.
    const error = send({
      type: mode,
      playerId: player.id,
      amount: unit === 'chips' ? points : numeric,
      unit: unit === 'chips' ? 'points' : unit,
    })
    if (error) return
    setAmount('')
    setChipDrafts({})
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={mode === 'deposit' ? 'default' : 'secondary'} size="sm">
          {mode === 'deposit' ? <ArrowDownLeftIcon /> : <ArrowUpRightIcon />}
          {mode === 'deposit' ? 'Cash in' : 'Cash out'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'deposit' ? 'Cash in' : 'Cash out'} · {player.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Balance {formatPokerAmount(balance, game.config)}
            {game.config.currencyMode === 'dollars' ? ` (${balance} pts)` : ''}
          </p>
          <Segmented
            value={unit}
            onChange={(v) => setUnit(v as CashInputMode)}
            options={[
              { value: 'points', label: 'Points' },
              { value: 'dollars', label: 'Dollars' },
              { value: 'chips', label: 'Chips' },
            ]}
          />
          {unit === 'chips' ? (
            <div className="grid gap-2">
              {game.config.chips.map((chip) => (
                <div
                  key={chip.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-2"
                >
                  <PokerChip color={chip.color} size={28} label={String(chip.value)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{chip.label}</div>
                    <div className="text-[11px] text-muted-foreground">{chip.value} pts each</div>
                  </div>
                  <span className="text-muted-foreground">×</span>
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    className="h-9 w-16 text-center font-mono tabular-nums"
                    value={chipDrafts[chip.id] ?? ''}
                    onChange={(e) =>
                      setChipDrafts((prev) => ({
                        ...prev,
                        [chip.id]: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              {unit === 'dollars' ? (
                <DollarSignIcon
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
              <Input
                inputMode="decimal"
                autoFocus
                placeholder={unit === 'dollars' ? '0.00' : '0'}
                className={cn(
                  'h-11 font-mono text-lg tabular-nums',
                  unit === 'dollars' && 'pl-8',
                )}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
          )}
          {points > 0 && (
            <p className="text-xs text-muted-foreground">
              = {formatPokerAmount(points, { currencyMode: 'points', pointsPerDollar: 1 })}
              {game.config.currencyMode === 'dollars' || unit === 'dollars'
                ? ` · ${formatPokerAmount(points, game.config)}`
                : ''}
            </p>
          )}
          {mode === 'withdraw' && breakdown.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Take these chips</div>
              <div className="flex flex-wrap gap-3">
                {breakdown.map(({ chip, count }) => (
                  <div key={chip.id} className="flex items-center gap-2">
                    <PokerChip color={chip.color} size={36} label={String(chip.value)} />
                    <div className="text-sm">
                      <div className="font-semibold">×{count}</div>
                      <div className="text-[11px] text-muted-foreground">{chip.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!(points > 0) || (mode === 'withdraw' && points > balance)}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BankSettingsDialog({ game, send }: { game: PokerBankState; send: GamePlayProps['send'] }) {
  const [open, setOpen] = React.useState(false)
  const [currencyMode, setCurrencyMode] = React.useState<PokerCurrencyMode>(game.config.currencyMode)
  const [pointsPerDollar, setPointsPerDollar] = React.useState(game.config.pointsPerDollar)
  const [startingStack, setStartingStack] = React.useState(game.config.startingStack)
  const [chips, setChips] = React.useState(game.config.chips)

  React.useEffect(() => {
    if (!open) return
    setCurrencyMode(game.config.currencyMode)
    setPointsPerDollar(game.config.pointsPerDollar)
    setStartingStack(game.config.startingStack)
    setChips(game.config.chips)
  }, [open, game.config])

  const updateChip = (index: number, patch: Partial<PokerChipDenom>) => {
    setChips(chips.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  const save = () => {
    const error = send({
      type: 'updateConfig',
      config: { currencyMode, pointsPerDollar, startingStack, chips },
    })
    if (!error) setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2Icon /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bank settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Display as</Label>
              <Segmented
                value={currencyMode}
                onChange={(v) => setCurrencyMode(v as PokerCurrencyMode)}
                options={[
                  { value: 'points', label: 'Points' },
                  { value: 'dollars', label: 'Dollars' },
                ]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Points per dollar</Label>
              <PointsPerDollarField value={pointsPerDollar} onChange={setPointsPerDollar} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Starting stack (points)</Label>
            <Input
              inputMode="numeric"
              className="h-9 font-mono tabular-nums"
              value={String(startingStack)}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value.replace(/\D/g, ''), 10)
                setStartingStack(Number.isNaN(n) ? 0 : Math.min(1_000_000, n))
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Applies to players who join after you save. Balances stay in points; dollars is only a
              display.
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Chip denominations</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setChips([
                    ...chips,
                    {
                      id: `chip-${chips.length + 1}-${Date.now().toString(36)}`,
                      label: 'New',
                      value: 1,
                      color: '#a1a1aa',
                    },
                  ])
                }
              >
                Add chip
              </Button>
            </div>
            <div className="grid gap-2">
              {chips.map((chip, index) => (
                <div
                  key={chip.id}
                  className="grid grid-cols-[auto_1fr_1fr_6.5rem_auto] items-center gap-2 rounded-lg border border-border/60 px-2 py-2"
                >
                  <PokerChip color={chip.color} size={28} label={String(chip.value)} />
                  <Input
                    value={chip.label}
                    className="h-8"
                    placeholder="Label"
                    onChange={(e) => updateChip(index, { label: e.target.value.slice(0, 16) })}
                  />
                  <ChipValueField
                    value={chip.value}
                    onChange={(value) => updateChip(index, { value })}
                  />
                  <ColorPicker
                    value={chip.color}
                    onChange={(color) => updateChip(index, { color })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={chips.length <= 1}
                    onClick={() => setChips(chips.filter((_, i) => i !== index))}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save}>Save bank</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ClaimMergePanel({ state }: { state: GamePlayProps['state'] }) {
  const claimSeat = useSession((s) => s.claimSeat)
  const mergePlayers = useSession((s) => s.mergePlayers)
  const engine = getGameEngine(state.gameId)
  if (!engine?.claimSeat && !engine?.mergePlayers) return null

  const guests = state.players.filter((p) => !p.remote && !p.isHost)
  const remotes = state.players.filter((p) => p.remote)
  const [claimerId, setClaimerId] = React.useState(remotes[0]?.id ?? '')
  const [seatId, setSeatId] = React.useState(guests[0]?.id ?? '')
  const [fromId, setFromId] = React.useState('')
  const [toId, setToId] = React.useState('')

  React.useEffect(() => {
    if (!remotes.find((p) => p.id === claimerId)) setClaimerId(remotes[0]?.id ?? '')
    if (!guests.find((p) => p.id === seatId)) setSeatId(guests[0]?.id ?? '')
  }, [remotes, guests, claimerId, seatId])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Seats & accounts</CardTitle>
        <CardDescription className="text-xs">
          Let a phone claim a guest seat, or merge two accounts later.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {engine.claimSeat && (
          <div className="grid gap-2 rounded-xl border border-border/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <UserRoundCheckIcon className="size-3.5" /> Claim guest seat
            </div>
            {guests.length === 0 || remotes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Need a host-created guest and a joined player.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    value={claimerId}
                    onChange={(e) => setClaimerId(e.target.value)}
                  >
                    {remotes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (player)
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    value={seatId}
                    onChange={(e) => setSeatId(e.target.value)}
                  >
                    {guests.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (guest)
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  disabled={!claimerId || !seatId}
                  onClick={() => claimSeat(claimerId, seatId)}
                >
                  Claim seat
                </Button>
              </>
            )}
          </div>
        )}

        {engine.mergePlayers && (
          <div className="grid gap-2 rounded-xl border border-border/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <GitMergeIcon className="size-3.5" /> Merge accounts
            </div>
            <p className="text-[11px] text-muted-foreground">
              Guest → player always lands on the player. Player → player: pick who keeps the
              combined stack.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
              >
                <option value="">Merge away…</option>
                {state.players
                  .filter((p) => !p.isHost)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {!p.remote ? ' (guest)' : ''}
                    </option>
                  ))}
              </select>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
              >
                <option value="">Into…</option>
                {state.players
                  .filter((p) => p.id !== fromId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {!p.remote && !p.isHost ? ' (guest)' : ''}
                    </option>
                  ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!fromId || !toId}
              onClick={() => mergePlayers(fromId, toId)}
            >
              Merge
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PokerPlay({ state, me, isHost, send }: GamePlayProps) {
  const game = state.game as PokerBankState
  const ranked = [...state.players].sort(
    (a, b) => (game.banks[b.id]?.balance ?? 0) - (game.banks[a.id]?.balance ?? 0),
  )
  const recent = [...game.ledger].slice(-8).reverse()

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-sm">Bank</CardTitle>
            <CardDescription className="text-xs">
              Start {formatPokerAmount(game.config.startingStack, game.config)}
              {' · '}
              {game.config.currencyMode === 'dollars'
                ? `Dollars · ${game.config.pointsPerDollar} pts/$`
                : 'Points'}
            </CardDescription>
          </div>
          {isHost && <BankSettingsDialog game={game} send={send} />}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {game.config.chips.map((chip) => (
            <div
              key={chip.id}
              className="flex items-center gap-1.5 rounded-full border border-border/50 bg-background/40 px-2 py-1"
            >
              <PokerChip color={chip.color} size={28} label={String(chip.value)} />
              <span className="text-sm font-semibold">
                {chip.label} · {chip.value}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {ranked.map((player) => {
          const balance = game.banks[player.id]?.balance ?? 0
          const mine = me?.id === player.id
          const canAct = isHost || mine
          const isGuest = !player.remote && !player.isHost
          const identity = (
            <>
              <PlayerAvatar player={player} size="sm" showPresence />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{player.name}</span>
                  {player.isHost && <Badge variant="secondary">host</Badge>}
                  {isGuest && <Badge variant="outline">guest</Badge>}
                </div>
                <div className="font-mono text-sm font-bold tabular-nums text-primary">
                  {formatPokerAmount(balance, game.config)}
                </div>
              </div>
            </>
          )
          return (
            <Card key={player.id} className={cn(mine && 'border-primary/40')}>
              <CardContent className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
                {isHost && isGuest ? (
                  <EditGuestDialog player={player}>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      aria-label={`Edit ${player.name}`}
                    >
                      {identity}
                    </button>
                  </EditGuestDialog>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">{identity}</div>
                )}
                {canAct && (
                  <div className="flex flex-wrap gap-2">
                    <CashDialog mode="deposit" player={player} game={game} send={send} />
                    <CashDialog mode="withdraw" player={player} game={game} send={send} />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {isHost && (
        <div className="flex flex-wrap gap-2">
          <AddGuestButton />
        </div>
      )}
      {isHost && <ClaimMergePanel state={state} />}

      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {recent.map((entry) => {
              const who = state.players.find((p) => p.id === entry.playerId)?.name ?? 'Player'
              const sign = entry.points >= 0 ? '+' : ''
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span className="truncate">
                    <span className="font-medium text-foreground/80">{who}</span> {entry.kind}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </span>
                  <span className="font-mono tabular-nums">
                    {sign}
                    {formatPokerAmount(Math.abs(entry.points), game.config)}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export const pokerBankUI: GameUIModule = {
  id: 'poker-bank',
  icon: CoinsIcon,
  SetupForm: PokerSetup as GameUIModule['SetupForm'],
  PlayView: PokerPlay,
  configSummary: (config) => {
    const c = config as PokerBankConfig
    return [
      `Start ${c.startingStack} pts`,
      c.currencyMode === 'dollars' ? `$${c.pointsPerDollar} pts/$` : 'Points',
      `${c.chips.length} chips`,
    ]
  },
}
