import {
  CRIBBAGE_PEG_KIND_LABELS,
  CRIBBAGE_QUICK_PEGS,
  CRIBBAGE_RANKS,
  CRIBBAGE_SUITS,
  cribbageIsSkunk,
  cribbageTotals,
  scoreCribbageHand,
  type CribbageCard,
  type CribbageConfig,
  type CribbagePegKind,
  type CribbageRank,
  type CribbageState,
  type CribbageSuit,
  type SessionState,
} from '@jamez/core'
import {
  CalculatorIcon,
  CircleDotIcon,
  Redo2Icon,
  Undo2Icon,
  XIcon,
} from 'lucide-react'
import * as React from 'react'
import { PlayerAvatar } from '@/components/player-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

const SUIT_GLYPH: Record<CribbageSuit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
}

const PLAY_KINDS: CribbagePegKind[] = [
  'heels',
  'fifteen',
  'pair',
  'triplet',
  'four',
  'run',
  'go',
  'thirtyOne',
  'hand',
  'crib',
  'nobs',
  'custom',
]

function CribbageSetup({ config, onChange }: GameSetupProps<CribbageConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Play to</Label>
        <Segmented
          value={config.targetScore === 61 ? '61' : '121'}
          onChange={(value) => {
            const targetScore = value === '61' ? 61 : 121
            onChange({
              targetScore,
              skunkLine: Math.floor(targetScore / 2),
            })
          }}
          options={[
            { value: '121', label: '121 (standard)' },
            { value: '61', label: '61 (short)' },
          ]}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cribbage-skunk" className="text-xs text-muted-foreground">
          Skunk / lurch line
        </Label>
        <Input
          id="cribbage-skunk"
          inputMode="numeric"
          value={String(config.skunkLine)}
          onChange={(e) => {
            const value = Number.parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
            onChange({
              ...config,
              skunkLine: Number.isNaN(value) ? 0 : Math.min(config.targetScore, value),
            })
          }}
          className="h-9 font-mono tabular-nums"
        />
        <p className="text-xs text-muted-foreground">
          Per Bicycle: first to {config.targetScore}. If the loser is still below{' '}
          {config.skunkLine} when the winner pegs out, they are lurched (double game).
        </p>
      </div>
    </div>
  )
}

function HandCalculator({
  playerName,
  onApply,
}: {
  playerName: string
  onApply: (points: number, kind: 'hand' | 'crib') => void
}) {
  const [open, setOpen] = React.useState(false)
  const [hand, setHand] = React.useState<(CribbageCard | null)[]>([null, null, null, null])
  const [starter, setStarter] = React.useState<CribbageCard | null>(null)
  const [isCrib, setIsCrib] = React.useState(false)
  const [pickRank, setPickRank] = React.useState<CribbageRank>('5')
  const [pickSuit, setPickSuit] = React.useState<CribbageSuit>('S')
  const [target, setTarget] = React.useState<'hand' | 'starter'>('hand')
  const [handIndex, setHandIndex] = React.useState(0)

  const complete = hand.every((c) => c !== null) && starter !== null
  const breakdown = complete
    ? scoreCribbageHand(hand as CribbageCard[], starter!, { isCrib })
    : null

  const placeCard = () => {
    const next = { rank: pickRank, suit: pickSuit }
    if (target === 'starter') {
      setStarter(next)
      return
    }
    setHand((prev) => {
      const copy = [...prev]
      copy[handIndex] = next
      return copy
    })
    setHandIndex((i) => Math.min(3, i + 1))
  }

  const reset = () => {
    setHand([null, null, null, null])
    setStarter(null)
    setHandIndex(0)
    setIsCrib(false)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalculatorIcon /> Hand calculator
      </Button>
    )
  }

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Count {playerName}&apos;s {isCrib ? 'crib' : 'hand'}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <XIcon />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-xs text-muted-foreground">
          Four cards + starter. Fifteens, pairs, runs, flush, and His Nobs — Bicycle combination
          rules.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {hand.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setTarget('hand')
                setHandIndex(i)
              }}
              className={cn(
                'flex h-12 w-10 flex-col items-center justify-center rounded-lg border font-mono text-sm',
                target === 'hand' && handIndex === i
                  ? 'border-emerald-400/70 bg-emerald-400/15'
                  : 'border-border/60 bg-background/40',
                c && (c.suit === 'H' || c.suit === 'D') && 'text-rose-300',
              )}
            >
              {c ? (
                <>
                  <span>{c.rank}</span>
                  <span className="text-xs">{SUIT_GLYPH[c.suit]}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{i + 1}</span>
              )}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">+</span>
          <button
            type="button"
            onClick={() => setTarget('starter')}
            className={cn(
              'flex h-12 w-10 flex-col items-center justify-center rounded-lg border font-mono text-sm',
              target === 'starter'
                ? 'border-amber-400/70 bg-amber-400/15'
                : 'border-border/60 bg-background/40',
              starter && (starter.suit === 'H' || starter.suit === 'D') && 'text-rose-300',
            )}
          >
            {starter ? (
              <>
                <span>{starter.rank}</span>
                <span className="text-xs">{SUIT_GLYPH[starter.suit]}</span>
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground">cut</span>
            )}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {CRIBBAGE_RANKS.map((rank) => (
            <button
              key={rank}
              type="button"
              onClick={() => setPickRank(rank)}
              className={cn(
                'h-8 rounded-md border font-mono text-xs tabular-nums',
                pickRank === rank
                  ? 'border-emerald-400/60 bg-emerald-400/20'
                  : 'border-border/50 bg-background/40 text-muted-foreground',
              )}
            >
              {rank}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {CRIBBAGE_SUITS.map((suit) => (
            <button
              key={suit}
              type="button"
              onClick={() => setPickSuit(suit)}
              className={cn(
                'h-9 flex-1 rounded-lg border text-lg',
                pickSuit === suit
                  ? 'border-emerald-400/60 bg-emerald-400/20'
                  : 'border-border/50 bg-background/40 text-muted-foreground',
                (suit === 'H' || suit === 'D') && 'text-rose-300',
              )}
            >
              {SUIT_GLYPH[suit]}
            </button>
          ))}
          <Button type="button" variant="secondary" className="h-9 px-3" onClick={placeCard}>
            Place
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <Label htmlFor="cribbage-crib" className="text-xs text-muted-foreground">
            Counting the crib
          </Label>
          <Switch id="cribbage-crib" checked={isCrib} onCheckedChange={setIsCrib} />
        </div>
        {breakdown && (
          <div className="rounded-lg bg-emerald-400/10 px-3 py-2 font-mono text-xs tabular-nums text-emerald-100">
            <div className="flex justify-between gap-2">
              <span>15s {breakdown.fifteens}</span>
              <span>pairs {breakdown.pairs}</span>
              <span>runs {breakdown.runs}</span>
              <span>flush {breakdown.flush}</span>
              <span>nobs {breakdown.nobs}</span>
            </div>
            <div className="mt-1 text-center text-sm font-semibold">Total {breakdown.total}</div>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            Clear
          </Button>
          <Button
            className="flex-1"
            disabled={!breakdown || breakdown.total < 1}
            onClick={() => {
              if (!breakdown || breakdown.total < 1) return
              onApply(breakdown.total, isCrib ? 'crib' : 'hand')
              reset()
              setOpen(false)
            }}
          >
            Peg {breakdown && breakdown.total > 0 ? `+${breakdown.total}` : 'count'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function PegPad({ state: session, me, isHost, send }: GamePlayProps) {
  const game = session.game as CribbageState
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const [playerOverride, setPlayerOverride] = React.useState<string | null>(null)
  const [kind, setKind] = React.useState<CribbagePegKind>('custom')
  const defaultPlayer =
    me && game.playerIds.includes(me.id) ? me.id : isHost ? game.playerIds[0]! : game.playerIds.find((id) => id === me?.id) ?? game.playerIds[0]!
  const playerId =
    playerOverride && game.playerIds.includes(playerOverride) ? playerOverride : defaultPlayer

  const canPegFor = (id: string) => isHost || (me && me.id === id)

  const doPeg = (points: number, pegKind: CribbagePegKind = kind) => {
    send({ type: 'peg', playerId, points, kind: pegKind })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Peg points</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Who scores?</Label>
          <Segmented
            value={playerId}
            onChange={(id) => {
              if (!canPegFor(id)) return
              setPlayerOverride(id)
            }}
            options={game.playerIds.map((id) => ({
              value: id,
              label: (
                <span className={cn('flex items-center gap-1.5', !canPegFor(id) && 'opacity-40')}>
                  <span>{playerOf(id)?.emoji}</span>
                  {playerOf(id)?.name ?? '?'}
                </span>
              ),
            }))}
          />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {CRIBBAGE_QUICK_PEGS.map((n) => (
            <Button
              key={n}
              type="button"
              variant="secondary"
              disabled={!canPegFor(playerId)}
              className="h-12 font-mono text-base tabular-nums"
              onClick={() => doPeg(n)}
            >
              +{n}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PLAY_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                kind === k
                  ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100'
                  : 'border-border/50 bg-background/40 text-muted-foreground hover:bg-muted/40',
              )}
            >
              {CRIBBAGE_PEG_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <HandCalculator
          playerName={playerOf(playerId)?.name ?? 'player'}
          onApply={(points, pegKind) => {
            if (!canPegFor(playerId)) return
            doPeg(points, pegKind)
          }}
        />
        {!isHost && (
          <p className="text-center text-xs text-muted-foreground/70">
            Peg your own points as you score. The host can score for anyone and undo mistakes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function CribbagePlay(props: GamePlayProps) {
  const { state: session, isHost, send } = props
  const game = session.game as CribbageState
  const totals = cribbageTotals(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const skunked = cribbageIsSkunk(game)

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        {game.playerIds.map((id) => {
          const player = playerOf(id)
          const total = totals[id] ?? 0
          const progress = Math.min(1, total / game.config.targetScore)
          const skunkProgress = Math.min(1, game.config.skunkLine / game.config.targetScore)
          const isDealer = game.dealerId === id
          if (!player) return null
          return (
            <Card
              key={id}
              role={isHost ? 'button' : undefined}
              tabIndex={isHost ? 0 : undefined}
              aria-pressed={isHost ? isDealer : undefined}
              aria-label={isHost ? `Set ${player.name} as dealer` : undefined}
              onClick={
                isHost && !isDealer ? () => send({ type: 'setDealer', playerId: id }) : undefined
              }
              onKeyDown={
                isHost && !isDealer
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        send({ type: 'setDealer', playerId: id })
                      }
                    }
                  : undefined
              }
              className={cn(
                isDealer && 'ring-1 ring-primary/40',
                isHost && !isDealer && 'cursor-pointer transition-colors hover:bg-muted/40',
              )}
            >
              <CardContent className="flex flex-col items-center gap-1.5 p-4">
                <PlayerAvatar player={player} showPresence />
                <div className="max-w-full truncate text-sm font-medium">{player.name}</div>
                <div className="font-mono text-4xl font-bold tabular-nums">{total}</div>
                <div className="text-xs text-muted-foreground">
                  {isDealer ? 'dealer · crib' : 'pone'}
                </div>
                <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 w-px bg-amber-400/80"
                    style={{ left: `${skunkProgress * 100}%` }}
                    title={`Skunk line ${game.config.skunkLine}`}
                  />
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>
          First to <span className="font-semibold text-foreground">{game.config.targetScore}</span>
          {' · '}
          skunk below {game.config.skunkLine}
        </span>
        {isHost && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => send({ type: 'nextDeal' })}>
            <Redo2Icon className="size-3.5" /> Next deal
          </Button>
        )}
      </div>
      {skunked && (
        <p className="text-center text-xs font-medium text-amber-200">Lurch / skunk — double game</p>
      )}

      <PegPad {...props} />

      {game.pegs.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Pegs</CardTitle>
            {isHost && (
              <Button variant="ghost" size="sm" onClick={() => send({ type: 'undoPeg' })}>
                <Undo2Icon /> Undo last
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {[...game.pegs].reverse().map((peg) => {
              const scorer = playerOf(peg.playerId)
              return (
                <div
                  key={peg.n}
                  className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm"
                >
                  <span className="w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">
                    #{peg.n}
                  </span>
                  <span className="shrink-0">{scorer?.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {scorer?.name} · {CRIBBAGE_PEG_KIND_LABELS[peg.kind]}
                  </span>
                  <span className="shrink-0 font-mono font-semibold tabular-nums text-emerald-300">
                    +{peg.points}
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

function CribbageResults({ state: session }: { state: SessionState }) {
  const game = session.game as CribbageState
  const totals = cribbageTotals(game)
  const skunked = cribbageIsSkunk(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const sorted = [...game.playerIds].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Final board</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {sorted.map((id) => {
          const player = playerOf(id)
          const score = totals[id] ?? 0
          const winner = sorted[0] === id && score >= game.config.targetScore
          return (
            <div key={id} className="rounded-xl border border-border/50 p-3">
              <div className="flex items-center gap-2">
                <span>{player?.emoji}</span>
                <span className="flex-1 font-medium">{player?.name}</span>
                <span className="font-mono text-xl font-bold tabular-nums text-primary">{score}</span>
              </div>
              <div className="mt-1 pl-7 text-xs text-muted-foreground">
                {winner && skunked
                  ? 'Won with a skunk / lurch (double game)'
                  : winner
                    ? 'Winner'
                    : skunked
                      ? 'Lurched (below skunk line)'
                      : `${game.config.targetScore - score} short of ${game.config.targetScore}`}
              </div>
            </div>
          )
        })}
        <p className="text-center text-xs text-muted-foreground/70">
          {game.pegs.length} {game.pegs.length === 1 ? 'peg' : 'pegs'} recorded
        </p>
      </CardContent>
    </Card>
  )
}

export const cribbageUI: GameUIModule = {
  id: 'cribbage',
  icon: CircleDotIcon,
  SetupForm: CribbageSetup as GameUIModule['SetupForm'],
  PlayView: CribbagePlay,
  ResultsDetail: CribbageResults,
  configSummary: (config) => {
    const c = config as CribbageConfig
    return [`First to ${c.targetScore}`, `Skunk below ${c.skunkLine}`]
  },
}
