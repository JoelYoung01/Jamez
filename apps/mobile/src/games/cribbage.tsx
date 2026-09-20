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
import { clsx } from 'clsx'
import {
  CalculatorIcon,
  CircleDotIcon,
  Redo2Icon,
  Undo2Icon,
  XIcon,
} from 'lucide-react-native'
import * as React from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { AppTextInput } from '@/components/app-text-input'
import { PlayerAvatar } from '@/components/player-avatar'
import { Segmented } from '@/components/segmented'
import { AppButton, Card, SectionLabel } from '@/components/ui'
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
    <View className="gap-3">
      <View className="gap-1.5">
        <Text className="text-xs text-muted-foreground">Play to</Text>
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
            { value: '121', label: '121' },
            { value: '61', label: '61' },
          ]}
        />
      </View>
      <View className="gap-1.5">
        <Text className="text-xs text-muted-foreground">Skunk / lurch line</Text>
        <AppTextInput
          value={String(config.skunkLine)}
          keyboardType="number-pad"
          onChangeText={(t) => {
            const parsed = Number.parseInt(t.replace(/[^0-9]/g, ''), 10)
            onChange({
              ...config,
              skunkLine: Number.isNaN(parsed) ? 0 : Math.min(config.targetScore, parsed),
            })
          }}
          className="h-10 rounded-lg border border-line bg-field px-3 font-mono text-base text-zinc-100"
        />
        <Text className="text-xs text-muted-foreground">
          Bicycle: first to {config.targetScore}. Loser below {config.skunkLine} when the winner
          pegs out is lurched (double game).
        </Text>
      </View>
    </View>
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
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 active:opacity-70"
      >
        <CalculatorIcon size={14} color="#a1a1ab" />
        <Text className="text-sm text-muted-foreground">Hand calculator</Text>
      </Pressable>
    )
  }

  return (
    <Card className="gap-3 border-emerald-500/30 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-zinc-100">
          Count {playerName}&apos;s {isCrib ? 'crib' : 'hand'}
        </Text>
        <Pressable onPress={() => setOpen(false)} hitSlop={8} className="active:opacity-70">
          <XIcon size={16} color="#a1a1ab" />
        </Pressable>
      </View>
      <Text className="text-xs text-muted-foreground">
        Four cards + starter. Fifteens, pairs, runs, flush, His Nobs.
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        {hand.map((c, i) => (
          <Pressable
            key={i}
            onPress={() => {
              setTarget('hand')
              setHandIndex(i)
            }}
            className={clsx(
              'h-12 w-10 items-center justify-center rounded-lg border',
              target === 'hand' && handIndex === i
                ? 'border-emerald-400/70 bg-emerald-400/15'
                : 'border-line bg-field',
            )}
          >
            {c ? (
              <>
                <Text
                  className={clsx(
                    'font-mono text-sm',
                    c.suit === 'H' || c.suit === 'D' ? 'text-rose-300' : 'text-zinc-100',
                  )}
                >
                  {c.rank}
                </Text>
                <Text
                  className={clsx(
                    'text-xs',
                    c.suit === 'H' || c.suit === 'D' ? 'text-rose-300' : 'text-zinc-300',
                  )}
                >
                  {SUIT_GLYPH[c.suit]}
                </Text>
              </>
            ) : (
              <Text className="text-muted-foreground">{i + 1}</Text>
            )}
          </Pressable>
        ))}
        <Text className="text-xs text-muted-foreground">+</Text>
        <Pressable
          onPress={() => setTarget('starter')}
          className={clsx(
            'h-12 w-10 items-center justify-center rounded-lg border',
            target === 'starter' ? 'border-amber-400/70 bg-amber-400/15' : 'border-line bg-field',
          )}
        >
          {starter ? (
            <>
              <Text
                className={clsx(
                  'font-mono text-sm',
                  starter.suit === 'H' || starter.suit === 'D' ? 'text-rose-300' : 'text-zinc-100',
                )}
              >
                {starter.rank}
              </Text>
              <Text
                className={clsx(
                  'text-xs',
                  starter.suit === 'H' || starter.suit === 'D' ? 'text-rose-300' : 'text-zinc-300',
                )}
              >
                {SUIT_GLYPH[starter.suit]}
              </Text>
            </>
          ) : (
            <Text className="text-[10px] text-muted-foreground">cut</Text>
          )}
        </Pressable>
      </View>
      <View className="flex-row flex-wrap gap-1">
        {CRIBBAGE_RANKS.map((rank) => (
          <Pressable
            key={rank}
            onPress={() => setPickRank(rank)}
            className={clsx(
              'h-8 min-w-8 items-center justify-center rounded-md border px-1',
              pickRank === rank
                ? 'border-emerald-400/60 bg-emerald-400/20'
                : 'border-line bg-field',
            )}
          >
            <Text className="font-mono text-xs text-zinc-100">{rank}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row gap-1.5">
        {CRIBBAGE_SUITS.map((suit) => (
          <Pressable
            key={suit}
            onPress={() => setPickSuit(suit)}
            className={clsx(
              'h-9 flex-1 items-center justify-center rounded-lg border',
              pickSuit === suit
                ? 'border-emerald-400/60 bg-emerald-400/20'
                : 'border-line bg-field',
            )}
          >
            <Text
              className={clsx(
                'text-lg',
                suit === 'H' || suit === 'D' ? 'text-rose-300' : 'text-zinc-100',
              )}
            >
              {SUIT_GLYPH[suit]}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={placeCard}
          className="h-9 items-center justify-center rounded-lg border border-line bg-card px-3 active:opacity-70"
        >
          <Text className="text-sm text-zinc-100">Place</Text>
        </Pressable>
      </View>
      <View className="flex-row items-center justify-between rounded-lg border border-line px-3 py-2">
        <Text className="text-xs text-muted-foreground">Counting the crib</Text>
        <Switch
          value={isCrib}
          onValueChange={setIsCrib}
          trackColor={{ true: '#86efac' }}
          thumbColor="#ffffff"
        />
      </View>
      {breakdown && (
        <View className="rounded-lg bg-emerald-400/10 px-3 py-2">
          <Text className="text-center font-mono text-xs tabular-nums text-emerald-100">
            15s {breakdown.fifteens} · pairs {breakdown.pairs} · runs {breakdown.runs} · flush{' '}
            {breakdown.flush} · nobs {breakdown.nobs}
          </Text>
          <Text className="mt-1 text-center text-sm font-semibold text-emerald-100">
            Total {breakdown.total}
          </Text>
        </View>
      )}
      <View className="flex-row gap-2">
        <Pressable onPress={reset} className="justify-center px-3 active:opacity-70">
          <Text className="text-sm text-muted-foreground">Clear</Text>
        </Pressable>
        <View className="flex-1">
          <AppButton
            title={breakdown && breakdown.total > 0 ? `Peg +${breakdown.total}` : 'Peg count'}
            disabled={!breakdown || breakdown.total < 1}
            onPress={() => {
              if (!breakdown || breakdown.total < 1) return
              onApply(breakdown.total, isCrib ? 'crib' : 'hand')
              reset()
              setOpen(false)
            }}
          />
        </View>
      </View>
    </Card>
  )
}

function PegPad({ state: session, me, isHost, send }: GamePlayProps) {
  const game = session.game as CribbageState
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const [playerOverride, setPlayerOverride] = React.useState<string | null>(null)
  const [kind, setKind] = React.useState<CribbagePegKind>('custom')
  const defaultPlayer =
    me && game.playerIds.includes(me.id)
      ? me.id
      : game.playerIds[0]!
  const playerId =
    playerOverride && game.playerIds.includes(playerOverride) ? playerOverride : defaultPlayer
  const canPegFor = (id: string) => isHost || (me && me.id === id)

  const doPeg = (points: number, pegKind: CribbagePegKind = kind) => {
    send({ type: 'peg', playerId, points, kind: pegKind })
  }

  return (
    <Card className="gap-3 p-4">
      <Text className="text-sm font-semibold text-zinc-100">Peg points</Text>
      <View className="gap-1.5">
        <SectionLabel>Who scores?</SectionLabel>
        <Segmented
          value={playerId}
          onChange={(id) => {
            if (!canPegFor(id)) return
            setPlayerOverride(id)
          }}
          options={game.playerIds.map((id) => ({
            value: id,
            label: `${playerOf(id)?.emoji ?? ''} ${playerOf(id)?.name ?? '?'}`,
          }))}
        />
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {CRIBBAGE_QUICK_PEGS.map((n) => (
          <Pressable
            key={n}
            disabled={!canPegFor(playerId)}
            onPress={() => doPeg(n)}
            className={clsx(
              'h-12 min-w-[22%] flex-1 items-center justify-center rounded-lg border border-line bg-field active:opacity-70',
              !canPegFor(playerId) && 'opacity-40',
            )}
          >
            <Text className="font-mono text-base text-zinc-100">+{n}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {PLAY_KINDS.map((k) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            className={clsx(
              'rounded-full border px-2.5 py-1',
              kind === k
                ? 'border-emerald-400/50 bg-emerald-400/15'
                : 'border-line bg-field',
            )}
          >
            <Text
              className={clsx(
                'text-[11px]',
                kind === k ? 'text-emerald-100' : 'text-muted-foreground',
              )}
            >
              {CRIBBAGE_PEG_KIND_LABELS[k]}
            </Text>
          </Pressable>
        ))}
      </View>
      <HandCalculator
        playerName={playerOf(playerId)?.name ?? 'player'}
        onApply={(points, pegKind) => {
          if (!canPegFor(playerId)) return
          doPeg(points, pegKind)
        }}
      />
      {!isHost && (
        <Text className="text-center text-xs text-muted-foreground">
          Peg your own points as you score. The host can score for anyone and undo mistakes.
        </Text>
      )}
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
    <View className="gap-3">
      <View className="flex-row gap-3">
        {game.playerIds.map((id) => {
          const player = playerOf(id)
          const total = totals[id] ?? 0
          const progress = Math.min(1, total / game.config.targetScore)
          const skunkProgress = Math.min(1, game.config.skunkLine / game.config.targetScore)
          const isDealer = game.dealerId === id
          if (!player) return null
          return (
            <Pressable
              key={id}
              disabled={!isHost || isDealer}
              accessibilityRole={isHost ? 'button' : undefined}
              accessibilityState={isHost ? { selected: isDealer } : undefined}
              accessibilityLabel={isHost ? `Set ${player.name} as dealer` : undefined}
              onPress={
                isHost && !isDealer ? () => send({ type: 'setDealer', playerId: id }) : undefined
              }
              className="flex-1 active:opacity-80"
            >
              <Card className={clsx('items-center gap-1 p-4', isDealer && 'border-primary/40')}>
                <PlayerAvatar player={player} showPresence />
                <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                  {player.name}
                </Text>
                <Text className="font-mono text-4xl font-bold text-zinc-100">{total}</Text>
                <Text className="text-xs text-muted-foreground">
                  {isDealer ? 'dealer · crib' : 'pone'}
                </Text>
                <View className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <View
                    className="absolute inset-y-0 w-px bg-amber-400/80"
                    style={{ left: `${skunkProgress * 100}%` }}
                  />
                  <View
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progress * 100}%` }}
                  />
                </View>
              </Card>
            </Pressable>
          )
        })}
      </View>
      <View className="flex-row items-center justify-center gap-2">
        <Text className="text-center text-xs text-muted-foreground">
          First to {game.config.targetScore} · skunk below {game.config.skunkLine}
        </Text>
        {isHost && (
          <Pressable
            onPress={() => send({ type: 'nextDeal' })}
            className="flex-row items-center gap-1 active:opacity-70"
          >
            <Redo2Icon size={14} color="#a1a1ab" />
            <Text className="text-xs text-muted-foreground">Next deal</Text>
          </Pressable>
        )}
      </View>
      {skunked && (
        <Text className="text-center text-xs font-medium text-amber-200">
          Lurch / skunk — double game
        </Text>
      )}

      <PegPad {...props} />

      {game.pegs.length > 0 && (
        <Card className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-zinc-100">Pegs</Text>
            {isHost && (
              <Pressable
                onPress={() => send({ type: 'undoPeg' })}
                className="flex-row items-center gap-1 active:opacity-70"
              >
                <Undo2Icon size={14} color="#a1a1ab" />
                <Text className="text-sm text-muted-foreground">Undo last</Text>
              </Pressable>
            )}
          </View>
          {[...game.pegs].reverse().map((peg) => {
            const scorer = playerOf(peg.playerId)
            return (
              <View
                key={peg.n}
                className="flex-row items-center gap-2.5 rounded-lg border border-line bg-field px-3 py-2"
              >
                <Text className="w-6 text-center font-mono text-xs text-muted-foreground">
                  #{peg.n}
                </Text>
                <Text>{scorer?.emoji}</Text>
                <Text className="flex-1 text-sm text-zinc-200" numberOfLines={1}>
                  {scorer?.name} · {CRIBBAGE_PEG_KIND_LABELS[peg.kind]}
                </Text>
                <Text className="font-mono text-sm font-semibold text-emerald-300">
                  +{peg.points}
                </Text>
              </View>
            )
          })}
        </Card>
      )}
    </View>
  )
}

function CribbageResults({ state: session }: { state: SessionState }) {
  const game = session.game as CribbageState
  const totals = cribbageTotals(game)
  const skunked = cribbageIsSkunk(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const sorted = [...game.playerIds].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))

  return (
    <Card className="gap-3 p-4">
      <Text className="text-sm font-semibold text-zinc-100">Final board</Text>
      {sorted.map((id) => {
        const player = playerOf(id)
        const score = totals[id] ?? 0
        const winner = sorted[0] === id && score >= game.config.targetScore
        return (
          <View key={id} className="rounded-xl border border-line p-3">
            <View className="flex-row items-center gap-2">
              <Text>{player?.emoji}</Text>
              <Text className="flex-1 text-sm font-medium text-zinc-100">{player?.name}</Text>
              <Text className="font-mono text-xl font-bold text-primary">{score}</Text>
            </View>
            <Text className="mt-1 pl-7 text-xs text-muted-foreground">
              {winner && skunked
                ? 'Won with a skunk / lurch (double game)'
                : winner
                  ? 'Winner'
                  : skunked
                    ? 'Lurched (below skunk line)'
                    : `${game.config.targetScore - score} short of ${game.config.targetScore}`}
            </Text>
          </View>
        )
      })}
      <Text className="text-center text-xs text-muted-foreground">
        {game.pegs.length} {game.pegs.length === 1 ? 'peg' : 'pegs'} recorded
      </Text>
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
