import {
  bullheadsOnCard,
  sixNimmtRoundComplete,
  sixNimmtTotals,
  sumBullheads,
  type SessionState,
  type SixNimmtConfig,
  type SixNimmtState,
} from '@jamez/core'
import { clsx } from 'clsx'
import {
  BeefIcon,
  CalculatorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LayersIcon,
  Undo2Icon,
  XIcon,
} from 'lucide-react-native'
import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { AppTextInput } from '@/components/app-text-input'
import { PlayerAvatar } from '@/components/player-avatar'
import { AppButton, Card, CardTitle, Muted } from '@/components/ui'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

const ACCENT = '#e8a317'
const QUICK_CARDS = [55, 11, 22, 33, 44, 66, 77, 88, 99] as const

function SixNimmtSetup({ config, onChange }: GameSetupProps<SixNimmtConfig>) {
  return (
    <View className="gap-1.5">
      <Muted>Play to</Muted>
      <AppTextInput
        keyboardType="number-pad"
        value={String(config.targetScore)}
        onChangeText={(raw) => {
          const value = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10)
          onChange({
            ...config,
            targetScore: Number.isNaN(value) ? 1 : Math.min(9999, Math.max(1, value)),
          })
        }}
        className="rounded-xl border border-line bg-field px-3 py-2.5 font-mono text-zinc-100"
      />
      <Muted>
        Official 6 nimmt! ends when someone reaches 66 bullheads at the end of a round. Lowest total
        wins, and a tie shares the win.
      </Muted>
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
    <AppTextInput
      keyboardType="number-pad"
      editable={!disabled}
      placeholder="—"
      value={text}
      onChangeText={(raw) => {
        const next = raw.replace(/[^0-9]/g, '').slice(0, 3)
        if (next === '' || /^\d{0,3}$/.test(next)) setText(next)
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
    <Card className="gap-3 border-amber-500/30 p-4">
      <View className="flex-row items-center justify-between">
        <CardTitle>Bull pile</CardTitle>
        <Pressable onPress={onClose} hitSlop={8} className="active:opacity-70" accessibilityLabel="Close calculator">
          <XIcon size={18} color="#a1a1ab" />
        </Pressable>
      </View>
      <Muted>55 is 7 · doubles are 5 · tens are 3 · fives are 2 · every other card is 1.</Muted>
      <View className="flex-row flex-wrap gap-1.5">
        {QUICK_CARDS.map((n) => {
          const on = cards.includes(n)
          return (
            <Pressable
              key={n}
              onPress={() => toggle(n)}
              className={clsx(
                'h-9 min-w-14 items-center justify-center rounded-lg border px-2',
                on ? 'border-amber-400/60 bg-amber-400/20' : 'border-line bg-field',
              )}
            >
              <Text className={clsx('font-mono text-xs', on ? 'text-amber-100' : 'text-muted-foreground')}>
                {n} · {bullheadsOnCard(n)}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <View className="flex-row items-center gap-2">
        <AppTextInput
          keyboardType="number-pad"
          placeholder="Card #"
          value={draft}
          onChangeText={(raw) => setDraft(raw.replace(/[^0-9]/g, '').slice(0, 3))}
          onSubmitEditing={addDraft}
          className="h-10 flex-1 rounded-xl border border-line bg-field px-3 font-mono text-zinc-100"
        />
        <AppButton title="Add" variant="outline" onPress={addDraft} />
      </View>
      {error && <Text className="text-xs text-red-300">{error}</Text>}
      {cards.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {cards.map((n) => (
            <Pressable
              key={n}
              onPress={() => toggle(n)}
              className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1"
            >
              <Text className="font-mono text-xs text-amber-100">
                {n} · {bullheadsOnCard(n)} ×
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View className="flex-row items-center justify-between rounded-lg border border-line px-3 py-2">
        <Text className="text-xs text-muted-foreground">Other cards (1 each)</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            disabled={plain <= 0}
            onPress={() => setPlain((n) => Math.max(0, n - 1))}
            className="h-8 w-8 items-center justify-center rounded-lg border border-line active:opacity-70"
          >
            <Text className="text-zinc-100">−</Text>
          </Pressable>
          <Text className="w-6 text-center font-mono text-zinc-100">{plain}</Text>
          <Pressable
            disabled={plain >= 76}
            onPress={() => setPlain((n) => Math.min(76, n + 1))}
            className="h-8 w-8 items-center justify-center rounded-lg border border-line active:opacity-70"
          >
            <Text className="text-zinc-100">+</Text>
          </Pressable>
        </View>
      </View>
      <View className="flex-row items-center justify-between rounded-xl bg-amber-400/10 px-4 py-3">
        <Text className="text-sm font-medium text-amber-100">Bullheads</Text>
        <Text className="font-mono text-3xl font-bold text-amber-100">{total}</Text>
      </View>
      <AppButton title={`Use ${total}`} disabled={total > 999} onPress={() => onApply(total)} />
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
    <View className="gap-3">
      {sortedIds.map((id) => {
        const player = playerOf(id)
        const total = totals[id] ?? 0
        const progress = Math.min(1, Math.max(0, total / Math.max(1, game.config.targetScore)))
        const over = total >= game.config.targetScore
        if (!player) return null
        return (
          <Card key={id} className="flex-row items-center gap-3 p-3">
            <PlayerAvatar player={player} showPresence />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                {player.name}
              </Text>
              <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <View
                  className="h-full rounded-full"
                  style={{ width: `${progress * 100}%`, backgroundColor: over ? '#f87171' : ACCENT }}
                />
              </View>
            </View>
            <View className="items-end">
              <Text className={clsx('font-mono text-2xl font-bold', over ? 'text-red-300' : 'text-zinc-100')}>
                {total}
              </Text>
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
                disabled={!canAdvance}
                onPress={() => {
                  send({ type: 'addRound' })
                  setActiveRound(game.rounds.length)
                }}
                className="active:opacity-70"
              >
                <LayersIcon size={18} color={!canAdvance ? '#52525b' : '#a1a1ab'} />
              </Pressable>
            </View>
          )}
        </View>
        <Muted>Enter the bullheads each player took this round. Fewer is better.</Muted>
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
                    accessibilityLabel={`Count ${player.name}'s bullheads`}
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
                <BullPileCalculator
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
          <Muted className="text-center">Enter the bullheads you took. The host can fix anyone's score.</Muted>
        )}
        {canAdvance && isHost && (
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
                      className={clsx('min-w-10 rounded px-1.5 py-1', idx === roundIndex && 'bg-amber-400/10')}
                    >
                      <Text
                        className={clsx(
                          'text-center font-mono text-xs',
                          idx === roundIndex ? 'text-amber-100' : 'text-muted-foreground',
                        )}
                      >
                        {typeof score === 'number' ? score : '·'}
                      </Text>
                    </Pressable>
                  )
                })}
                <Text className="ml-auto font-mono text-sm font-semibold text-zinc-100">{totals[id] ?? 0}</Text>
              </View>
            )
          })}
        </Card>
      )}
    </View>
  )
}

function SixNimmtResults({ state: session }: { state: SessionState }) {
  const game = session.game as SixNimmtState
  const totals = sixNimmtTotals(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const sorted = [...game.playerIds].sort((a, b) => (totals[a] ?? 0) - (totals[b] ?? 0))

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
              {game.rounds.map((r) => (typeof r.scores[id] === 'number' ? String(r.scores[id]) : '·')).join(' · ')}
            </Text>
          </View>
        )
      })}
      <Muted className="text-center">
        {game.rounds.length} {game.rounds.length === 1 ? 'round' : 'rounds'} · to {game.config.targetScore} ·
        lowest wins
      </Muted>
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
