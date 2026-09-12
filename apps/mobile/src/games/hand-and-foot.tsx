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
import { clsx } from 'clsx'
import {
  CalculatorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FootprintsIcon,
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

const ACCENT = '#d4524a'
const MAX_ABS = 99_999

function HandAndFootSetup({ config, onChange }: GameSetupProps<HandAndFootConfig>) {
  return (
    <View className="gap-1.5">
      <SectionLabel>Play to</SectionLabel>
      <AppTextInput
        keyboardType="number-pad"
        value={String(config.targetScore)}
        onChangeText={(raw) => {
          const value = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10)
          onChange({
            ...config,
            targetScore: Number.isNaN(value) ? 0 : Math.min(99_999, value),
          })
        }}
        className="rounded-xl border border-line bg-field px-3 py-2.5 font-mono text-zinc-100"
      />
      <Muted>
        Common Hand & Foot races to 10,000. One seat per team (or per player for cutthroat).
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
    <AppTextInput
      keyboardType="numbers-and-punctuation"
      editable={!disabled}
      placeholder="—"
      value={text}
      onChangeText={(raw) => {
        const next = raw.replace(/[^0-9-]/g, '').slice(0, 6)
        if (next === '' || next === '-' || /^-?\d{0,5}$/.test(next)) setText(next)
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

function StepperRow({
  label,
  hint,
  value,
  onChange,
  min = 0,
}: {
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
  min?: number
}) {
  return (
    <View className="flex-row items-center justify-between rounded-xl border border-line px-3 py-2">
      <View className="mr-2 min-w-0 flex-1">
        <Text className="text-xs font-medium text-zinc-100">{label}</Text>
        {hint ? <Text className="text-[10px] text-muted-foreground">{hint}</Text> : null}
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          className="h-8 w-8 items-center justify-center rounded-lg bg-field active:opacity-70"
        >
          <Text className="text-zinc-100">−</Text>
        </Pressable>
        <Text className="w-8 text-center font-mono text-zinc-100">{value}</Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          className="h-8 w-8 items-center justify-center rounded-lg bg-field active:opacity-70"
        >
          <Text className="text-zinc-100">+</Text>
        </Pressable>
      </View>
    </View>
  )
}

function ScoreCalculator({
  onApply,
  onClose,
}: {
  onApply: (score: number) => void
  onClose: () => void
}) {
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

  return (
    <Card className="gap-2 border border-[#d4524a]/30 p-3">
      <View className="flex-row items-center justify-between">
        <CardTitle>Round calculator</CardTitle>
        <Pressable onPress={onClose} className="active:opacity-70">
          <XIcon size={18} color="#a1a1ab" />
        </Pressable>
      </View>
      <Muted>
        Clean {HAND_AND_FOOT_CLEAN_BOOK} · Dirty {HAND_AND_FOOT_DIRTY_BOOK} · Wild{' '}
        {HAND_AND_FOOT_WILD_BOOK} · Red 3s ±{HAND_AND_FOOT_RED_THREE} · Out +
        {HAND_AND_FOOT_GOING_OUT}
      </Muted>
      <StepperRow
        label="Clean books"
        hint={`+${HAND_AND_FOOT_CLEAN_BOOK} each`}
        value={cleanBooks}
        onChange={setCleanBooks}
      />
      <StepperRow
        label="Dirty books"
        hint={`+${HAND_AND_FOOT_DIRTY_BOOK} each`}
        value={dirtyBooks}
        onChange={setDirtyBooks}
      />
      <StepperRow
        label="Wild books"
        hint={`+${HAND_AND_FOOT_WILD_BOOK} each`}
        value={wildBooks}
        onChange={setWildBooks}
      />
      <StepperRow
        label="Red threes"
        hint={`±${HAND_AND_FOOT_RED_THREE} (negative if caught)`}
        value={redThrees}
        onChange={setRedThrees}
        min={-20}
      />
      <View className="flex-row items-center justify-between rounded-xl border border-line px-3 py-2">
        <Text className="text-xs text-muted-foreground">Went out (+{HAND_AND_FOOT_GOING_OUT})</Text>
        <Switch value={wentOut} onValueChange={setWentOut} />
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">Card points</Text>
          <AppTextInput
            keyboardType="number-pad"
            value={String(cardPoints)}
            onChangeText={(raw) => {
              const value = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10)
              setCardPoints(Number.isNaN(value) ? 0 : Math.min(MAX_ABS, value))
            }}
            className="rounded-xl border border-line bg-field px-3 py-2 font-mono text-zinc-100"
          />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">Cards left (−)</Text>
          <AppTextInput
            keyboardType="number-pad"
            value={String(cardsLeft)}
            onChangeText={(raw) => {
              const value = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10)
              setCardsLeft(Number.isNaN(value) ? 0 : Math.min(MAX_ABS, value))
            }}
            className="rounded-xl border border-line bg-field px-3 py-2 font-mono text-zinc-100"
          />
        </View>
      </View>
      <View className="flex-row items-center justify-between rounded-xl bg-[#d4524a]/10 px-4 py-3">
        <Text className="text-sm font-medium text-[#f0a29c]">Round score</Text>
        <Text className="font-mono text-3xl font-bold text-[#f0a29c]">{preview}</Text>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <AppButton
            title={`Use ${preview}`}
            onPress={() => {
              onApply(preview)
              reset()
              onClose()
            }}
          />
        </View>
        <Pressable
          onPress={reset}
          className="items-center justify-center rounded-xl px-4 active:opacity-70"
        >
          <Text className="text-sm text-muted-foreground">Clear</Text>
        </Pressable>
      </View>
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
                <View
                  className="h-full rounded-full"
                  style={{ width: `${progress * 100}%`, backgroundColor: ACCENT }}
                />
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
                        idx === roundIndex && 'bg-[#d4524a]/10',
                      )}
                    >
                      <Text
                        className={clsx(
                          'text-center font-mono text-xs',
                          idx === roundIndex ? 'text-[#f0a29c]' : 'text-muted-foreground',
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

function HandAndFootResults({ state: session }: { state: SessionState }) {
  const game = session.game as HandAndFootState
  const totals = handAndFootTotals(game)
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
