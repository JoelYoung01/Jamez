import {
  bullheadsOnCard,
  sixNimmtRoundComplete,
  sixNimmtTotals,
  sumBullheads,
  type SixNimmtConfig,
  type SixNimmtState,
  type SessionState,
} from '@jamez/core'
import {
  BeefIcon,
  CalculatorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LayersIcon,
  Undo2Icon,
  XIcon,
} from 'lucide-react'
import * as React from 'react'
import { PlayerAvatar } from '@/components/player-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

const ACCENT = '#e8a317'
/** High-value cards worth tapping instead of typing. 55 is 7; the rest are doublets (5). */
const QUICK_CARDS = [55, 11, 22, 33, 44, 66, 77, 88, 99] as const

function SixNimmtSetup({ config, onChange }: GameSetupProps<SixNimmtConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="six-nimmt-target" className="text-xs text-muted-foreground">
        Play to
      </Label>
      <Input
        id="six-nimmt-target"
        inputMode="numeric"
        value={String(config.targetScore)}
        onChange={(e) => {
          const value = Number.parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
          onChange({ ...config, targetScore: Number.isNaN(value) ? 1 : Math.min(9999, Math.max(1, value)) })
        }}
        className="h-9 font-mono tabular-nums"
      />
      <p className="text-xs text-muted-foreground">
        Official 6 nimmt! ends when someone reaches 66 bullheads at the end of a round. Lowest total
        wins, and a tie shares the win.
      </p>
    </div>
  )
}

function RoundScoreField({
  value,
  disabled,
  onCommit,
}: {
  value: number | null
  disabled: boolean
  onCommit: (score: number | null) => void
}) {
  const [text, setText] = React.useState(value === null ? '' : String(value))
  React.useEffect(() => {
    setText(value === null ? '' : String(value))
  }, [value])

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed === '') {
      onCommit(null)
      setText('')
      return
    }
    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isNaN(parsed)) {
      setText(value === null ? '' : String(value))
      return
    }
    const clamped = Math.max(0, Math.min(999, parsed))
    setText(String(clamped))
    onCommit(clamped)
  }

  return (
    <Input
      inputMode="numeric"
      disabled={disabled}
      placeholder="—"
      value={text}
      onChange={(e) => {
        const next = e.target.value.replace(/[^0-9]/g, '').slice(0, 3)
        if (next === '' || /^\d{0,3}$/.test(next)) setText(next)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className="h-12 text-center font-mono text-lg tabular-nums"
    />
  )
}

function BullPileCalculator({
  onApply,
  onClose,
}: {
  onApply: (score: number) => void
  onClose: () => void
}) {
  const [cards, setCards] = React.useState<number[]>([])
  const [plain, setPlain] = React.useState(0)
  const [draft, setDraft] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const total = sumBullheads(cards) + plain

  const toggle = (n: number) => {
    setError(null)
    setCards((prev) =>
      prev.includes(n) ? prev.filter((card) => card !== n) : [...prev, n].sort((a, b) => a - b),
    )
  }

  const addDraft = () => {
    const n = Number.parseInt(draft, 10)
    if (bullheadsOnCard(n) === null) {
      setError('Cards are numbered 1–104')
      return
    }
    setError(null)
    setDraft('')
    setCards((prev) => (prev.includes(n) ? prev : [...prev, n].sort((a, b) => a - b)))
  }

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Bull pile</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close calculator">
          <XIcon />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-xs text-muted-foreground">
          55 is 7 · doubles are 5 · tens are 3 · fives are 2 · every other card is 1.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CARDS.map((n) => {
            const on = cards.includes(n)
            const heads = bullheadsOnCard(n)
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                className={cn(
                  'h-9 rounded-lg border px-2 font-mono text-xs tabular-nums',
                  on
                    ? 'border-amber-400/60 bg-amber-400/20 text-amber-100'
                    : 'border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40',
                )}
              >
                {n}
                <span className="ml-1 opacity-70">·{heads}</span>
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            placeholder="Card #"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDraft()
              }
            }}
            className="h-9 font-mono tabular-nums"
            aria-label="Card number"
          />
          <Button type="button" variant="outline" onClick={addDraft}>
            Add
          </Button>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
        {cards.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cards.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-xs text-amber-100"
              >
                {n} · {bullheadsOnCard(n)} ×
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">Other cards (1 each)</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={plain <= 0}
              onClick={() => setPlain((n) => Math.max(0, n - 1))}
              aria-label="Remove a 1-point card"
            >
              −
            </Button>
            <span className="w-6 text-center font-mono tabular-nums">{plain}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={plain >= 76}
              onClick={() => setPlain((n) => Math.min(76, n + 1))}
              aria-label="Add a 1-point card"
            >
              +
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            Bullheads <span className="font-mono text-lg font-semibold text-amber-100">{total}</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => onApply(total)}
              disabled={total > 999}
            >
              Use {total}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCards([])
                setPlain(0)
                setDraft('')
                setError(null)
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SixNimmtPlay({ state: session, me, isHost, send }: GamePlayProps) {
  const game = session.game as SixNimmtState
  const totals = sixNimmtTotals(game)
  const [activeRound, setActiveRound] = React.useState(Math.max(0, game.rounds.length - 1))
  const [calcFor, setCalcFor] = React.useState<string | null>(null)

  React.useEffect(() => {
    setActiveRound((prev) => {
      const latest = Math.max(0, game.rounds.length - 1)
      if (prev >= latest - 1) return latest
      return Math.min(prev, latest)
    })
  }, [game.rounds.length])

  const roundIndex = Math.min(activeRound, game.rounds.length - 1)
  const round = game.rounds[roundIndex]!
  const roundDone = sixNimmtRoundComplete(game, round)
  const isLatest = roundIndex === game.rounds.length - 1
  const crossed = game.playerIds.some((id) => (totals[id] ?? 0) >= game.config.targetScore)
  const canAdvance = isLatest && roundDone && !crossed
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const sortedIds = [...game.playerIds].sort((a, b) => (totals[a] ?? 0) - (totals[b] ?? 0))
  const canEdit = (playerId: string) => isHost || me?.id === playerId

  const setScore = (playerId: string, score: number | null) => {
    if (score === null) {
      send({ type: 'clearScore', playerId, roundIndex })
      return
    }
    send({ type: 'setScore', playerId, roundIndex, score })
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {sortedIds.map((id) => {
          const player = playerOf(id)
          const total = totals[id] ?? 0
          const progress = Math.min(1, Math.max(0, total / Math.max(1, game.config.targetScore)))
          const over = total >= game.config.targetScore
          if (!player) return null
          return (
            <Card key={id}>
              <CardContent className="flex items-center gap-3 p-3">
                <PlayerAvatar player={player} showPresence />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{player.name}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress * 100}%`, background: over ? '#f87171' : ACCENT }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={cn(
                      'font-mono text-2xl font-bold tabular-nums',
                      over && 'text-red-300',
                    )}
                  >
                    {total}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    / {game.config.targetScore}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={roundIndex <= 0}
              onClick={() => setActiveRound((r) => Math.max(0, r - 1))}
            >
              <ChevronLeftIcon />
            </Button>
            <CardTitle className="text-sm">Round {round.n}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              disabled={roundIndex >= game.rounds.length - 1}
              onClick={() => setActiveRound((r) => Math.min(game.rounds.length - 1, r + 1))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
          {isHost && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => send({ type: 'undoRound' })} title="Undo last round">
                <Undo2Icon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!canAdvance}
                onClick={() => {
                  void send({ type: 'addRound' })
                  setActiveRound((prev) => prev + 1)
                }}
              >
                <LayersIcon /> Next
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Enter the bullheads each player took this round. Fewer is better.
          </p>
          {game.playerIds.map((id) => {
            const player = playerOf(id)
            const editable = canEdit(id)
            if (!player) return null
            return (
              <div key={id} className="grid grid-cols-[1fr_7rem] items-center gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-lg">{player.emoji}</span>
                  <span className="truncate text-sm font-medium">{player.name}</span>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-8 px-2 text-xs text-muted-foreground"
                      aria-label={`Count ${player.name}'s bullheads`}
                      onClick={() => setCalcFor(calcFor === id ? null : id)}
                    >
                      <CalculatorIcon className="size-3.5" />
                    </Button>
                  )}
                </div>
                <RoundScoreField
                  value={round.scores[id] ?? null}
                  disabled={!editable}
                  onCommit={(score) => setScore(id, score)}
                />
                {calcFor === id && editable && (
                  <div className="col-span-2">
                    <BullPileCalculator
                      onApply={(score) => {
                        setScore(id, score)
                        setCalcFor(null)
                      }}
                      onClose={() => setCalcFor(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {!isHost && (
            <p className="text-center text-xs text-muted-foreground/70">
              Enter the bullheads you took. The host can fix anyone&apos;s score.
            </p>
          )}
          {canAdvance && isHost && (
            <Button
              onClick={() => {
                void send({ type: 'addRound' })
                setActiveRound((prev) => prev + 1)
              }}
            >
              Start round {game.rounds.length + 1}
            </Button>
          )}
        </CardContent>
      </Card>

      {game.rounds.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Scoresheet</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Player</th>
                  {game.rounds.map((r) => (
                    <th key={r.n} className="px-1 pb-2 text-center font-medium">
                      R{r.n}
                    </th>
                  ))}
                  <th className="pb-2 pl-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedIds.map((id) => {
                  const player = playerOf(id)
                  return (
                    <tr key={id} className="border-t border-border/40">
                      <td className="py-2 pr-2">
                        <span className="mr-1">{player?.emoji}</span>
                        {player?.name}
                      </td>
                      {game.rounds.map((r, idx) => {
                        const score = r.scores[id]
                        return (
                          <td key={r.n} className="px-1 py-2 text-center font-mono tabular-nums">
                            <button
                              type="button"
                              className={cn(
                                'w-full rounded px-1 py-0.5 hover:bg-muted/40',
                                idx === roundIndex && 'bg-amber-400/10 text-amber-100',
                              )}
                              onClick={() => setActiveRound(idx)}
                            >
                              {typeof score === 'number' ? score : '·'}
                            </button>
                          </td>
                        )
                      })}
                      <td className="py-2 pl-2 text-right font-mono font-semibold tabular-nums">
                        {totals[id] ?? 0}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SixNimmtResults({ state: session }: { state: SessionState }) {
  const game = session.game as SixNimmtState
  const totals = sixNimmtTotals(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const sorted = [...game.playerIds].sort((a, b) => (totals[a] ?? 0) - (totals[b] ?? 0))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Scoresheet</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-2 font-medium">Player</th>
              {game.rounds.map((r) => (
                <th key={r.n} className="px-1 pb-2 text-center font-medium">
                  R{r.n}
                </th>
              ))}
              <th className="pb-2 pl-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((id) => {
              const player = playerOf(id)
              return (
                <tr key={id} className="border-t border-border/40">
                  <td className="py-2 pr-2">
                    <span className="mr-1">{player?.emoji}</span>
                    {player?.name}
                  </td>
                  {game.rounds.map((r) => (
                    <td key={r.n} className="px-1 py-2 text-center font-mono tabular-nums">
                      {typeof r.scores[id] === 'number' ? r.scores[id] : '·'}
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right font-mono text-lg font-bold tabular-nums text-primary">
                    {totals[id] ?? 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-3 text-center text-xs text-muted-foreground/70">
          {game.rounds.length} {game.rounds.length === 1 ? 'round' : 'rounds'} · to{' '}
          {game.config.targetScore} · lowest wins
        </p>
      </CardContent>
    </Card>
  )
}

export const sixNimmtUI: GameUIModule = {
  id: 'six-nimmt',
  icon: BeefIcon,
  SetupForm: SixNimmtSetup as GameUIModule['SetupForm'],
  PlayView: SixNimmtPlay,
  ResultsDetail: SixNimmtResults,
  configSummary: (config) => {
    const c = config as SixNimmtConfig
    return [`To ${c.targetScore} · lowest wins`]
  },
}
