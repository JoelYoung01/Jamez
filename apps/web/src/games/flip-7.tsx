import {
  FLIP7_BONUS,
  FLIP7_NUMBER_CARDS,
  FLIP7_PLUS_MODIFIERS,
  flip7RoundComplete,
  flip7Totals,
  scoreFlip7Round,
  type Flip7Config,
  type Flip7State,
  type SessionState,
} from '@jamez/core'
import {
  CalculatorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlipHorizontal2Icon,
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
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

function Flip7Setup({ config, onChange }: GameSetupProps<Flip7Config>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="flip7-target" className="text-xs text-muted-foreground">
        Play to
      </Label>
      <Input
        id="flip7-target"
        inputMode="numeric"
        value={String(config.targetScore)}
        onChange={(e) => {
          const value = Number.parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
          onChange({ ...config, targetScore: Number.isNaN(value) ? 0 : Math.min(9999, value) })
        }}
        className="h-9 font-mono tabular-nums"
      />
      <p className="text-xs text-muted-foreground">
        Official Flip 7 races to 200. Enter each round&apos;s score on the pad — busts are 0.
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
    if (trimmed === '' || trimmed === '-') {
      onCommit(null)
      setText('')
      return
    }
    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isNaN(parsed)) {
      setText(value === null ? '' : String(value))
      return
    }
    const clamped = Math.max(-999, Math.min(999, parsed))
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
        const next = e.target.value.replace(/[^0-9-]/g, '').slice(0, 4)
        if (next === '' || next === '-' || /^-?\d{0,3}$/.test(next)) setText(next)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        }
      }}
      className="h-12 text-center font-mono text-lg tabular-nums"
    />
  )
}

function ScoreCalculator({ onApply }: { onApply: (score: number) => void }) {
  const [open, setOpen] = React.useState(false)
  const [numbers, setNumbers] = React.useState<number[]>([])
  const [plus, setPlus] = React.useState<number[]>([])
  const [timesTwo, setTimesTwo] = React.useState(false)
  const [flip7, setFlip7] = React.useState(false)
  const [busted, setBusted] = React.useState(false)

  const preview = scoreFlip7Round({
    numbers,
    plusModifiers: plus,
    timesTwo,
    flip7,
    busted,
  })

  const toggleNumber = (n: number) => {
    setBusted(false)
    setNumbers((prev) => {
      if (prev.includes(n)) {
        const next = prev.filter((x) => x !== n)
        if (next.length < 7) setFlip7(false)
        return next
      }
      if (prev.length >= 7) return prev
      const next = [...prev, n]
      if (next.length === 7) setFlip7(true)
      return next
    })
  }

  const togglePlus = (n: number) => {
    setBusted(false)
    setPlus((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
  }

  const reset = () => {
    setNumbers([])
    setPlus([])
    setTimesTwo(false)
    setFlip7(false)
    setBusted(false)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalculatorIcon /> Card calculator
      </Button>
    )
  }

  return (
    <Card className="border-cyan-500/30">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Round calculator</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <XIcon />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-xs text-muted-foreground">
          Numbers → ×2 → +N → Flip 7 (+{FLIP7_BONUS}). Bust scores 0.
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {FLIP7_NUMBER_CARDS.map((n) => {
            const on = numbers.includes(n)
            return (
              <button
                key={n}
                type="button"
                disabled={busted}
                onClick={() => toggleNumber(n)}
                className={cn(
                  'h-10 rounded-lg border font-mono text-sm tabular-nums transition-colors',
                  on
                    ? 'border-cyan-400/60 bg-cyan-400/20 text-cyan-100'
                    : 'border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40',
                  busted && 'opacity-40',
                )}
              >
                {n}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FLIP7_PLUS_MODIFIERS.map((n) => {
            const on = plus.includes(n)
            return (
              <button
                key={n}
                type="button"
                disabled={busted}
                onClick={() => togglePlus(n)}
                className={cn(
                  'h-9 min-w-12 rounded-lg border px-2 font-mono text-sm transition-colors',
                  on
                    ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
                    : 'border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40',
                  busted && 'opacity-40',
                )}
              >
                +{n}
              </button>
            )
          })}
          <button
            type="button"
            disabled={busted}
            onClick={() => {
              setBusted(false)
              setTimesTwo((v) => !v)
            }}
            className={cn(
              'h-9 min-w-12 rounded-lg border px-2 font-mono text-sm transition-colors',
              timesTwo
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-100'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40',
              busted && 'opacity-40',
            )}
          >
            ×2
          </button>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <Label htmlFor="flip7-bonus" className="text-xs text-muted-foreground">
              Flip 7 bonus (+{FLIP7_BONUS})
            </Label>
            <Switch
              id="flip7-bonus"
              checked={flip7 && !busted}
              disabled={busted}
              onCheckedChange={(v) => {
                setBusted(false)
                setFlip7(v)
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <Label htmlFor="flip7-bust" className="text-xs text-muted-foreground">
              Bust (score 0)
            </Label>
            <Switch id="flip7-bust" checked={busted} onCheckedChange={setBusted} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-cyan-400/10 px-4 py-3">
          <span className="text-sm font-medium text-cyan-100">Round score</span>
          <span className="font-mono text-3xl font-bold tabular-nums text-cyan-100">{preview}</span>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => {
              onApply(preview)
              reset()
              setOpen(false)
            }}
          >
            Use {preview}
          </Button>
          <Button variant="ghost" onClick={reset}>
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Flip7Play({ state: session, me, isHost, send }: GamePlayProps) {
  const game = session.game as Flip7State
  const totals = flip7Totals(game)
  const [activeRound, setActiveRound] = React.useState(Math.max(0, game.rounds.length - 1))
  const [calcFor, setCalcFor] = React.useState<string | null>(null)

  React.useEffect(() => {
    setActiveRound((prev) => Math.min(prev, Math.max(0, game.rounds.length - 1)))
  }, [game.rounds.length])

  const roundIndex = Math.min(activeRound, game.rounds.length - 1)
  const round = game.rounds[roundIndex]!
  const roundDone = flip7RoundComplete(game, round)
  const isLatest = roundIndex === game.rounds.length - 1
  const playerOf = (id: string) => session.players.find((p) => p.id === id)

  const sortedIds = [...game.playerIds].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))

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
          if (!player) return null
          return (
            <Card key={id}>
              <CardContent className="flex items-center gap-3 p-3">
                <PlayerAvatar player={player} showPresence />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{player.name}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#30ced5] transition-all"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-bold tabular-nums">{total}</div>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => send({ type: 'undoRound' })}
                title="Undo last round"
              >
                <Undo2Icon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!isLatest || !roundDone}
                onClick={() => {
                  send({ type: 'addRound' })
                  setActiveRound(game.rounds.length)
                }}
              >
                <LayersIcon /> Next
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
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
                    <ScoreCalculator
                      onApply={(score) => {
                        setScore(id, score)
                        setCalcFor(null)
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {!isHost && (
            <p className="text-center text-xs text-muted-foreground/70">
              Enter your round total. The host can fix anyone&apos;s score.
            </p>
          )}
          {isLatest && roundDone && isHost && (
            <Button
              onClick={() => {
                send({ type: 'addRound' })
                setActiveRound(game.rounds.length)
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
                    <th key={r.n} className="pb-2 px-1 text-center font-medium">
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
                                idx === roundIndex && 'bg-cyan-400/10 text-cyan-100',
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

function Flip7Results({ state: session }: { state: SessionState }) {
  const game = session.game as Flip7State
  const totals = flip7Totals(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const sorted = [...game.playerIds].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))

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
                <th key={r.n} className="pb-2 px-1 text-center font-medium">
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
          {game.rounds.length} {game.rounds.length === 1 ? 'round' : 'rounds'} · first to{' '}
          {game.config.targetScore}
        </p>
      </CardContent>
    </Card>
  )
}

export const flip7UI: GameUIModule = {
  id: 'flip-7',
  icon: FlipHorizontal2Icon,
  SetupForm: Flip7Setup as GameUIModule['SetupForm'],
  PlayView: Flip7Play,
  ResultsDetail: Flip7Results,
  configSummary: (config) => {
    const c = config as Flip7Config
    return [`First to ${c.targetScore}`]
  },
}
