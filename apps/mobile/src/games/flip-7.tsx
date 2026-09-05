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
import { clsx } from 'clsx'
import {
  CalculatorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlipHorizontal2Icon,
  LayersIcon,
  Undo2Icon,
  XIcon,
} from 'lucide-react-native'
import * as React from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { AppTextInput } from '@/components/app-text-input'
import { PlayerAvatar } from '@/components/player-avatar'
import { AppButton, Card, CardTitle, Muted, SectionLabel } from '@/components/ui'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

function Flip7Setup({ config, onChange }: GameSetupProps<Flip7Config>) {
  return (
    <View className="gap-1.5">
      <SectionLabel>Play to</SectionLabel>
      <AppTextInput
        keyboardType="number-pad"
        value={String(config.targetScore)}
        onChangeText={(raw) => {
          const value = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10)
          onChange({ ...config, targetScore: Number.isNaN(value) ? 0 : Math.min(9999, value) })
        }}
        className="rounded-xl border border-line bg-field px-3 py-2.5 font-mono text-zinc-100"
      />
      <Muted>Official Flip 7 races to 200. Enter each round's score — busts are 0.</Muted>
    </View>
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
    <AppTextInput
      keyboardType="numbers-and-punctuation"
      editable={!disabled}
      placeholder="—"
      value={text}
      onChangeText={(raw) => {
        const next = raw.replace(/[^0-9-]/g, '').slice(0, 4)
        if (next === '' || next === '-' || /^-?\d{0,3}$/.test(next)) setText(next)
      }}
      onBlur={commit}
      onSubmitEditing={commit}
      className={clsx(
        'h-12 w-28 rounded-xl border border-line bg-field px-2 text-center font-mono text-lg text-zinc-100',
        disabled && 'opacity-50',
      )}
    />
  )
}

function ScoreCalculator({ onApply, onClose }: { onApply: (score: number) => void; onClose: () => void }) {
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

  return (
    <Card className="gap-3 border-cyan-500/30 p-4">
      <View className="flex-row items-center justify-between">
        <CardTitle>Round calculator</CardTitle>
        <Pressable onPress={onClose} hitSlop={8} className="active:opacity-70">
          <XIcon size={18} color="#a1a1ab" />
        </Pressable>
      </View>
      <Muted>
        Numbers → ×2 → +N → Flip 7 (+{FLIP7_BONUS}). Bust scores 0.
      </Muted>
      <View className="flex-row flex-wrap gap-1.5">
        {FLIP7_NUMBER_CARDS.map((n) => {
          const on = numbers.includes(n)
          return (
            <Pressable
              key={n}
              disabled={busted}
              onPress={() => toggleNumber(n)}
              className={clsx(
                'h-10 w-10 items-center justify-center rounded-lg border',
                on ? 'border-cyan-400/60 bg-cyan-400/20' : 'border-line bg-field',
                busted && 'opacity-40',
              )}
            >
              <Text className={clsx('font-mono text-sm', on ? 'text-cyan-100' : 'text-muted-foreground')}>
                {n}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {FLIP7_PLUS_MODIFIERS.map((n) => {
          const on = plus.includes(n)
          return (
            <Pressable
              key={n}
              disabled={busted}
              onPress={() => togglePlus(n)}
              className={clsx(
                'h-9 min-w-12 items-center justify-center rounded-lg border px-2',
                on ? 'border-emerald-400/50 bg-emerald-400/15' : 'border-line bg-field',
                busted && 'opacity-40',
              )}
            >
              <Text className={clsx('font-mono text-sm', on ? 'text-emerald-200' : 'text-muted-foreground')}>
                +{n}
              </Text>
            </Pressable>
          )
        })}
        <Pressable
          disabled={busted}
          onPress={() => {
            setBusted(false)
            setTimesTwo((v) => !v)
          }}
          className={clsx(
            'h-9 min-w-12 items-center justify-center rounded-lg border px-2',
            timesTwo ? 'border-amber-400/50 bg-amber-400/15' : 'border-line bg-field',
            busted && 'opacity-40',
          )}
        >
          <Text className={clsx('font-mono text-sm', timesTwo ? 'text-amber-100' : 'text-muted-foreground')}>
            ×2
          </Text>
        </Pressable>
      </View>
      <View className="gap-2">
        <View className="flex-row items-center justify-between rounded-lg border border-line px-3 py-2">
          <Text className="text-xs text-muted-foreground">Flip 7 bonus (+{FLIP7_BONUS})</Text>
          <Switch
            value={flip7 && !busted}
            disabled={busted}
            onValueChange={(v) => {
              setBusted(false)
              setFlip7(v)
            }}
          />
        </View>
        <View className="flex-row items-center justify-between rounded-lg border border-line px-3 py-2">
          <Text className="text-xs text-muted-foreground">Bust (score 0)</Text>
          <Switch value={busted} onValueChange={setBusted} />
        </View>
      </View>
      <View className="flex-row items-center justify-between rounded-xl bg-cyan-400/10 px-4 py-3">
        <Text className="text-sm font-medium text-cyan-100">Round score</Text>
        <Text className="font-mono text-3xl font-bold text-cyan-100">{preview}</Text>
      </View>
      <AppButton
        title={`Use ${preview}`}
        onPress={() => {
          onApply(preview)
          onClose()
        }}
      />
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
    <View className="gap-3">
      {sortedIds.map((id) => {
        const player = playerOf(id)
        const total = totals[id] ?? 0
        const progress = Math.min(1, Math.max(0, total / Math.max(1, game.config.targetScore)))
        if (!player) return null
        return (
          <Card key={id} className="flex-row items-center gap-3 p-3">
            <PlayerAvatar player={player} showPresence />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                {player.name}
              </Text>
              <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <View className="h-full rounded-full bg-[#30ced5]" style={{ width: `${progress * 100}%` }} />
              </View>
            </View>
            <View className="items-end">
              <Text className="font-mono text-2xl font-bold text-zinc-100">{total}</Text>
              <Text className="text-[10px] uppercase tracking-wide text-muted-foreground">
                / {game.config.targetScore}
              </Text>
            </View>
          </Card>
        )
      })}

      <Card className="gap-3 p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Pressable
              disabled={roundIndex <= 0}
              onPress={() => setActiveRound((r) => Math.max(0, r - 1))}
              className="h-9 w-9 items-center justify-center active:opacity-70"
            >
              <ChevronLeftIcon size={20} color={roundIndex <= 0 ? '#52525b' : '#f4f4f5'} />
            </Pressable>
            <CardTitle>Round {round.n}</CardTitle>
            <Pressable
              disabled={roundIndex >= game.rounds.length - 1}
              onPress={() => setActiveRound((r) => Math.min(game.rounds.length - 1, r + 1))}
              className="h-9 w-9 items-center justify-center active:opacity-70"
            >
              <ChevronRightIcon
                size={20}
                color={roundIndex >= game.rounds.length - 1 ? '#52525b' : '#f4f4f5'}
              />
            </Pressable>
          </View>
          {isHost && (
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => send({ type: 'undoRound' })} className="active:opacity-70">
                <Undo2Icon size={18} color="#a1a1ab" />
              </Pressable>
              <Pressable
                disabled={!isLatest || !roundDone}
                onPress={() => {
                  send({ type: 'addRound' })
                  setActiveRound(game.rounds.length)
                }}
                className="active:opacity-70"
              >
                <LayersIcon size={18} color={!isLatest || !roundDone ? '#52525b' : '#a1a1ab'} />
              </Pressable>
            </View>
          )}
        </View>

        {game.playerIds.map((id) => {
          const player = playerOf(id)
          const editable = canEdit(id)
          if (!player) return null
          return (
            <View key={id} className="gap-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg">{player.emoji}</Text>
                <Text className="flex-1 text-sm font-medium text-zinc-100" numberOfLines={1}>
                  {player.name}
                </Text>
                {editable && (
                  <Pressable
                    onPress={() => setCalcFor(calcFor === id ? null : id)}
                    className="h-8 w-8 items-center justify-center active:opacity-70"
                  >
                    <CalculatorIcon size={16} color="#a1a1ab" />
                  </Pressable>
                )}
                <RoundScoreField
                  value={round.scores[id] ?? null}
                  disabled={!editable}
                  onCommit={(score) => setScore(id, score)}
                />
              </View>
              {calcFor === id && editable && (
                <ScoreCalculator
                  onApply={(score) => {
                    setScore(id, score)
                    setCalcFor(null)
                  }}
                  onClose={() => setCalcFor(null)}
                />
              )}
            </View>
          )
        })}

        {!isHost && (
          <Muted className="text-center">Enter your round total. The host can fix anyone's score.</Muted>
        )}
        {isLatest && roundDone && isHost && (
          <AppButton
            title={`Start round ${game.rounds.length + 1}`}
            onPress={() => {
              send({ type: 'addRound' })
              setActiveRound(game.rounds.length)
            }}
          />
        )}
      </Card>

      {game.rounds.length > 1 && (
        <Card className="gap-2 p-4">
          <CardTitle>Scoresheet</CardTitle>
          {sortedIds.map((id) => {
            const player = playerOf(id)
            return (
              <View key={id} className="flex-row flex-wrap items-center gap-1.5 border-t border-line pt-2">
                <Text className="mr-1 w-24 text-sm text-zinc-100" numberOfLines={1}>
                  {player?.emoji} {player?.name}
                </Text>
                {game.rounds.map((r, idx) => {
                  const score = r.scores[id]
                  return (
                    <Pressable
                      key={r.n}
                      onPress={() => setActiveRound(idx)}
                      className={clsx(
                        'min-w-10 rounded px-1.5 py-1',
                        idx === roundIndex && 'bg-cyan-400/10',
                      )}
                    >
                      <Text
                        className={clsx(
                          'text-center font-mono text-xs',
                          idx === roundIndex ? 'text-cyan-100' : 'text-muted-foreground',
                        )}
                      >
                        {typeof score === 'number' ? score : '·'}
                      </Text>
                    </Pressable>
                  )
                })}
                <Text className="ml-auto font-mono text-sm font-semibold text-zinc-100">
                  {totals[id] ?? 0}
                </Text>
              </View>
            )
          })}
        </Card>
      )}
    </View>
  )
}

function Flip7Results({ state: session }: { state: SessionState }) {
  const game = session.game as Flip7State
  const totals = flip7Totals(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const sorted = [...game.playerIds].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))

  return (
    <Card className="gap-3 p-4">
      <CardTitle>Scoresheet</CardTitle>
      {sorted.map((id) => {
        const player = playerOf(id)
        return (
          <View key={id} className="rounded-xl border border-line p-3">
            <View className="flex-row items-center gap-2">
              <Text>{player?.emoji}</Text>
              <Text className="flex-1 text-sm font-medium text-zinc-100">{player?.name}</Text>
              <Text className="font-mono text-xl font-bold text-primary">{totals[id] ?? 0}</Text>
            </View>
            <Text className="mt-1 pl-7 font-mono text-xs text-muted-foreground">
              {game.rounds
                .map((r) => (typeof r.scores[id] === 'number' ? String(r.scores[id]) : '·'))
                .join(' · ')}
            </Text>
          </View>
        )
      })}
      <Muted className="text-center">
        {game.rounds.length} {game.rounds.length === 1 ? 'round' : 'rounds'} · first to{' '}
        {game.config.targetScore}
      </Muted>
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
