import {
  HAND_AND_FOOT_CLEAN_BOOK,
  HAND_AND_FOOT_DIRTY_BOOK,
  HAND_AND_FOOT_GOING_OUT,
  HAND_AND_FOOT_RED_THREE,
  HAND_AND_FOOT_WILD_BOOK,
  handAndFootRoundComplete,
  handAndFootTotals,
  scoreHandAndFootRound,
  type HandAndFootConfig,
  type HandAndFootState,
  type SessionState,
} from '@jamez/core'
import {
  CalculatorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FootprintsIcon,
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

const ACCENT = '#d4524a'
const MAX_ABS = 99_999

function HandAndFootSetup({ config, onChange }: GameSetupProps<HandAndFootConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="haf-target" className="text-xs text-muted-foreground">
        Play to
      </Label>
      <Input
        id="haf-target"
        inputMode="numeric"
        value={String(config.targetScore)}
        onChange={(e) => {
          const value = Number.parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
          onChange({
            ...config,
            targetScore: Number.isNaN(value) ? 0 : Math.min(99_999, value),
          })
        }}
        className="h-9 font-mono tabular-nums"
      />
      <p className="text-xs text-muted-foreground">
        Common Hand &amp; Foot races to 10,000. Use one seat per team (or per player
        for cutthroat). Enter each deal&apos;s total — or use the book calculator.
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
    const clamped = Math.max(-MAX_ABS, Math.min(MAX_ABS, parsed))
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
        const next = e.target.value.replace(/[^0-9-]/g, '').slice(0, 6)
        if (next === '' || next === '-' || /^-?\d{0,5}$/.test(next)) setText(next)
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

function StepperField({
  label,
  value,
  onChange,
  min = 0,
  hint,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground/90">{label}</div>
        {hint ? <div className="text-[10px] text-muted-foreground">{hint}</div> : null}
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </Button>
        <span className="w-8 text-center font-mono tabular-nums">{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 px-0"
          onClick={() => onChange(value + 1)}
        >
          +
        </Button>
      </div>
    </div>
  )
}

function ScoreCalculator({ onApply }: { onApply: (score: number) => void }) {
  const [open, setOpen] = React.useState(false)
  const [cleanBooks, setCleanBooks] = React.useState(0)
  const [dirtyBooks, setDirtyBooks] = React.useState(0)
  const [wildBooks, setWildBooks] = React.useState(0)
  const [redThrees, setRedThrees] = React.useState(0)
  const [wentOut, setWentOut] = React.useState(false)
  const [cardPoints, setCardPoints] = React.useState(0)
  const [cardsLeft, setCardsLeft] = React.useState(0)

  const preview = scoreHandAndFootRound({
    cleanBooks,
    dirtyBooks,
    wildBooks,
    redThrees,
    wentOut,
    cardPoints,
    cardsLeft,
  })

  const reset = () => {
    setCleanBooks(0)
    setDirtyBooks(0)
    setWildBooks(0)
    setRedThrees(0)
    setWentOut(false)
    setCardPoints(0)
    setCardsLeft(0)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalculatorIcon /> Book calculator
      </Button>
    )
  }

  return (
    <Card className="border-[#d4524a]/30">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Round calculator</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <XIcon />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="text-xs text-muted-foreground">
          Clean {HAND_AND_FOOT_CLEAN_BOOK} · Dirty {HAND_AND_FOOT_DIRTY_BOOK} · Wild{' '}
          {HAND_AND_FOOT_WILD_BOOK} · Red 3s ±{HAND_AND_FOOT_RED_THREE} · Out +
          {HAND_AND_FOOT_GOING_OUT}
        </p>
        <StepperField
          label="Clean books"
          hint={`+${HAND_AND_FOOT_CLEAN_BOOK} each`}
          value={cleanBooks}
          onChange={setCleanBooks}
        />
        <StepperField
          label="Dirty books"
          hint={`+${HAND_AND_FOOT_DIRTY_BOOK} each`}
          value={dirtyBooks}
          onChange={setDirtyBooks}
        />
        <StepperField
          label="Wild books"
          hint={`+${HAND_AND_FOOT_WILD_BOOK} each`}
          value={wildBooks}
          onChange={setWildBooks}
        />
        <StepperField
          label="Red threes"
          hint={`±${HAND_AND_FOOT_RED_THREE} (negative if caught)`}
          value={redThrees}
          onChange={setRedThrees}
          min={-20}
        />
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <Label htmlFor="haf-out" className="text-xs text-muted-foreground">
            Went out (+{HAND_AND_FOOT_GOING_OUT})
          </Label>
          <Switch id="haf-out" checked={wentOut} onCheckedChange={setWentOut} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="haf-cards" className="text-xs text-muted-foreground">
              Card points
            </Label>
            <Input
              id="haf-cards"
              inputMode="numeric"
              value={String(cardPoints)}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
                setCardPoints(Number.isNaN(value) ? 0 : Math.min(MAX_ABS, value))
              }}
              className="h-9 font-mono tabular-nums"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="haf-left" className="text-xs text-muted-foreground">
              Cards left (−)
            </Label>
            <Input
              id="haf-left"
              inputMode="numeric"
              value={String(cardsLeft)}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
                setCardsLeft(Number.isNaN(value) ? 0 : Math.min(MAX_ABS, value))
              }}
              className="h-9 font-mono tabular-nums"
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-[#d4524a]/10 px-4 py-3">
          <span className="text-sm font-medium text-[#f0a29c]">Round score</span>
          <span className="font-mono text-3xl font-bold tabular-nums text-[#f0a29c]">
            {preview}
          </span>
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

function HandAndFootPlay({ state: session, me, isHost, send }: GamePlayProps) {
  const game = session.game as HandAndFootState
  const totals = handAndFootTotals(game)
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
  const roundDone = handAndFootRoundComplete(game, round)
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
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress * 100}%`, backgroundColor: ACCENT }}
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
          {game.playerIds.map((id) => {
            const player = playerOf(id)
            const editable = canEdit(id)
            if (!player) return null
            return (
              <div key={id} className="grid grid-cols-[1fr_7.5rem] items-center gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-lg">{player.emoji}</span>
                  <span className="truncate text-sm font-medium">{player.name}</span>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-8 px-2 text-xs text-muted-foreground"
                      aria-label={`Calculate ${player.name}'s round score`}
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
                                idx === roundIndex && 'bg-[#d4524a]/10 text-[#f0a29c]',
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

function HandAndFootResults({ state: session }: { state: SessionState }) {
  const game = session.game as HandAndFootState
  const totals = handAndFootTotals(game)
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

export const handAndFootUI: GameUIModule = {
  id: 'hand-and-foot',
  icon: FootprintsIcon,
  SetupForm: HandAndFootSetup as GameUIModule['SetupForm'],
  PlayView: HandAndFootPlay,
  ResultsDetail: HandAndFootResults,
  configSummary: (config) => {
    const c = config as HandAndFootConfig
    return [`First to ${c.targetScore}`]
  },
}
