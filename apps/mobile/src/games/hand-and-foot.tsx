import {
  HAND_AND_FOOT_CLEAN_BOOK,
  HAND_AND_FOOT_DIRTY_BOOK,
  HAND_AND_FOOT_GOING_OUT,
  HAND_AND_FOOT_RED_THREE,
  HAND_AND_FOOT_WILD_BOOK,
  handAndFootRoundComplete,
  handAndFootTotals,
  scoreHandAndFootRound,
  randomId,
  teamLabel,
  type HandAndFootConfig,
  type HandAndFootState,
  type HandAndFootTeam,
  type SessionState,
} from '@jamez/core'
import { clsx } from 'clsx'
import {
  CalculatorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FootprintsIcon,
  LayersIcon,
  PencilIcon,
  Undo2Icon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react-native'
import * as React from 'react'
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { AddLocalPlayerModal } from '@/components/add-local-player-modal'
import { AppTextInput } from '@/components/app-text-input'
import { PlayerAvatar } from '@/components/player-avatar'
import { Segmented } from '@/components/segmented'
import { AppButton, Card, CardTitle, Muted, SectionLabel } from '@/components/ui'
import { useSession } from '@/lib/session-store'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

const ACCENT = '#d4524a'
const MAX_ABS = 99_999

function playersPerTeamSummary(n: number): string {
  if (n === 1) return 'Cutthroat'
  if (n === 3) return 'Trios (3)'
  return 'Partners (2)'
}

function HandAndFootSetup({ config, onChange }: GameSetupProps<HandAndFootConfig>) {
  const playersPerTeam = config.playersPerTeam ?? 2
  return (
    <View className="gap-3">
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
      </View>
      <View className="gap-1.5">
        <SectionLabel>Players per team</SectionLabel>
        <Segmented
          value={String(playersPerTeam) as '1' | '2' | '3'}
          onChange={(v) => onChange({ ...config, playersPerTeam: Number(v) })}
          options={[
            { value: '1', label: 'Cutthroat (1)' },
            { value: '2', label: 'Partners (2)' },
            { value: '3', label: 'Trios (3)' },
          ]}
        />
      </View>
      <Muted>
        Common Hand & Foot races to 10,000. People are grouped into teams of{' '}
        {playersPerTeam} at the start; each score column is a team.
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

function TeamAvatars({
  team,
  playerOf,
}: {
  team: HandAndFootTeam
  playerOf: (id: string) => SessionState['players'][number] | undefined
}) {
  return (
    <View className="flex-row items-center">
      {team.playerIds.map((id, i) => {
        const player = playerOf(id)
        if (!player) return null
        return (
          <View key={id} className={i > 0 ? '-ml-2' : undefined}>
            <PlayerAvatar player={player} size="sm" showPresence />
          </View>
        )
      })}
    </View>
  )
}

/** Host pencil opens a sheet to rename, move, add, or remove players. */
function TeamEditControl({
  team,
  game,
  players,
  send,
}: {
  team: HandAndFootTeam
  game: HandAndFootState
  players: SessionState['players']
  send: GamePlayProps['send']
}) {
  const [open, setOpen] = React.useState(false)
  const label = teamLabel(team, players)
  return (
    <>
      <View className="min-w-0 flex-row items-center gap-1">
        <Text className="min-w-0 flex-1 text-sm font-medium text-zinc-100" numberOfLines={1}>
          {label}
        </Text>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityLabel={`Edit ${label}`}
          className="h-8 w-8 items-center justify-center active:opacity-70"
        >
          <PencilIcon size={14} color="#a1a1ab" />
        </Pressable>
      </View>
      {open ? (
        <TeamEditSheet
          teamId={team.id}
          game={game}
          players={players}
          send={send}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

function TeamEditSheet({
  teamId,
  game,
  players,
  send,
  onClose,
}: {
  teamId: string
  game: HandAndFootState
  players: SessionState['players']
  send: GamePlayProps['send']
  onClose: () => void
}) {
  const removePlayer = useSession((s) => s.removePlayer)
  const addLocalPlayer = useSession((s) => s.addLocalPlayer)
  const team = game.teams.find((t) => t.id === teamId)
  const fallback = team ? teamLabel({ ...team, name: undefined }, players) : 'Team'
  const [text, setText] = React.useState(team?.name ?? '')
  const [adding, setAdding] = React.useState(false)

  React.useEffect(() => {
    setText(team?.name ?? '')
  }, [team?.name, teamId])

  React.useEffect(() => {
    if (!team) onClose()
  }, [team, onClose])

  if (!team) return null

  const commitName = () => {
    const next = text.trim().slice(0, 24)
    const current = (team.name ?? '').trim()
    if (next !== current) send({ type: 'setTeamName', teamId: team.id, name: next })
  }

  const close = () => {
    commitName()
    onClose()
  }

  const otherTeams = game.teams.filter((t) => t.id !== team.id)
  const recruits = otherTeams.flatMap((t) =>
    t.playerIds.map((playerId) => ({
      playerId,
      fromTeam: t,
      player: players.find((p) => p.id === playerId),
    })),
  )

  return (
    <>
      <Modal transparent animationType="slide" visible onRequestClose={close}>
        <View className="flex-1 justify-end bg-black/60">
          <Pressable className="absolute inset-0" onPress={close} accessibilityLabel="Dismiss" />
          <View className="max-h-[90%] rounded-t-3xl border border-line bg-card">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 28 }}
            >
              <View className="gap-1">
                <Text className="text-lg font-semibold text-zinc-100">Edit team</Text>
                <Muted>Rename, move people, or add someone new.</Muted>
              </View>

              <View className="gap-2">
                <SectionLabel>Team name</SectionLabel>
                <AppTextInput
                  maxLength={24}
                  placeholder={fallback}
                  value={text}
                  onChangeText={(raw) => setText(raw.slice(0, 24))}
                  onBlur={commitName}
                  onSubmitEditing={commitName}
                  className="h-11 rounded-xl border border-line bg-field px-3 text-base text-zinc-100"
                />
                <Muted>Leave blank to use member names ({fallback}).</Muted>
              </View>

              <View className="gap-2">
                <SectionLabel>Members</SectionLabel>
                {team.playerIds.map((playerId) => {
                  const player = players.find((p) => p.id === playerId)
                  if (!player) return null
                  return (
                    <View
                      key={playerId}
                      className="gap-2 rounded-xl border border-line bg-background/40 px-3 py-2"
                    >
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base">{player.emoji}</Text>
                        <Text
                          className="min-w-0 flex-1 text-sm font-medium text-zinc-100"
                          numberOfLines={1}
                        >
                          {player.name}
                        </Text>
                        {!player.isHost ? (
                          <Pressable
                            onPress={() => removePlayer(playerId)}
                            accessibilityLabel={`Remove ${player.name}`}
                            className="h-8 w-8 items-center justify-center active:opacity-70"
                          >
                            <UserMinusIcon size={16} color="#f87171" />
                          </Pressable>
                        ) : null}
                      </View>
                      <View className="flex-row flex-wrap gap-1.5">
                        {otherTeams.map((t) => (
                          <Pressable
                            key={t.id}
                            onPress={() => send({ type: 'movePlayer', playerId, teamId: t.id })}
                            className="rounded-lg border border-line px-2 py-1 active:opacity-70"
                          >
                            <Text className="text-[10px] text-zinc-100" numberOfLines={1}>
                              → {teamLabel(t, players)}
                            </Text>
                          </Pressable>
                        ))}
                        {team.playerIds.length > 1 ? (
                          <Pressable
                            onPress={() => send({ type: 'splitPlayer', playerId })}
                            className="flex-row items-center gap-1 rounded-lg border border-line px-2 py-1 active:opacity-70"
                          >
                            <UsersIcon size={12} color="#f4f4f5" />
                            <Text className="text-[10px] text-zinc-100">Own team</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  )
                })}
              </View>

              <View className="gap-2">
                <SectionLabel>Add to this team</SectionLabel>
                {recruits.map(({ playerId, fromTeam, player }) => {
                  if (!player) return null
                  return (
                    <Pressable
                      key={playerId}
                      onPress={() => send({ type: 'movePlayer', playerId, teamId: team.id })}
                      className="flex-row items-center gap-3 rounded-xl border border-line bg-background/40 px-3 py-2 active:opacity-80"
                    >
                      <Text className="text-base">{player.emoji}</Text>
                      <Text
                        className="min-w-0 flex-1 text-sm font-medium text-zinc-100"
                        numberOfLines={1}
                      >
                        {player.name}
                      </Text>
                      <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                        from {teamLabel(fromTeam, players)}
                      </Text>
                    </Pressable>
                  )
                })}
                <AppButton
                  title="Add new player"
                  variant="outline"
                  size="sm"
                  icon={<UserPlusIcon size={14} color="#f4f4f5" />}
                  onPress={() => {
                    commitName()
                    setAdding(true)
                  }}
                />
              </View>

              <AppButton title="Done" onPress={close} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {adding ? (
        <AddLocalPlayerModal
          title="Add player to team"
          confirmLabel="Add to team"
          onClose={() => setAdding(false)}
          onConfirm={(profile) => {
            const id = profile.id?.trim() || randomId(8)
            addLocalPlayer({ ...profile, id })
            send({ type: 'movePlayer', playerId: id, teamId: team.id })
            setAdding(false)
          }}
        />
      ) : null}
    </>
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
  const sortedTeams = [...game.teams].sort(
    (a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0),
  )
  const canEdit = (team: HandAndFootTeam) =>
    isHost || (!!me && team.playerIds.includes(me.id))

  const setScore = (teamId: string, score: number | null) => {
    if (score === null) {
      send({ type: 'clearScore', teamId, roundIndex })
      return
    }
    send({ type: 'setScore', teamId, roundIndex, score })
  }

  return (
    <View className="gap-3">
      {sortedTeams.map((team) => {
        const total = totals[team.id] ?? 0
        const progress = Math.min(1, Math.max(0, total / Math.max(1, game.config.targetScore)))
        const label = teamLabel(team, session.players)
        return (
          <Card key={team.id} className="flex-row items-center gap-3 p-3">
            <TeamAvatars team={team} playerOf={playerOf} />
            <View className="min-w-0 flex-1">
              {isHost ? (
                <TeamEditControl
                  team={team}
                  game={game}
                  players={session.players}
                  send={send}
                />
              ) : (
                <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                  {label}
                </Text>
              )}
              <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                {team.playerIds
                  .map((id) => playerOf(id)?.name)
                  .filter(Boolean)
                  .join(' · ')}
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

        {game.teams.map((team) => {
          const editable = canEdit(team)
          const label = teamLabel(team, session.players)
          return (
            <View key={team.id} className="gap-2">
              <View className="flex-row items-start gap-2">
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row items-center gap-2">
                    <TeamAvatars team={team} playerOf={playerOf} />
                    <Text className="min-w-0 flex-1 text-sm font-medium text-zinc-100" numberOfLines={1}>
                      {label}
                    </Text>
                    {editable && (
                      <Pressable
                        onPress={() => setCalcFor(calcFor === team.id ? null : team.id)}
                        className="h-8 w-8 items-center justify-center active:opacity-70"
                      >
                        <CalculatorIcon size={16} color="#a1a1ab" />
                      </Pressable>
                    )}
                  </View>
                  {team.playerIds.map((playerId) => {
                    const player = playerOf(playerId)
                    if (!player) return null
                    return (
                      <View key={playerId} className="flex-row items-center gap-1.5 pl-1">
                        <Text className="text-sm">{player.emoji}</Text>
                        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                          {player.name}
                        </Text>
                      </View>
                    )
                  })}
                </View>
                <RoundScoreField
                  value={round.scores[team.id] ?? null}
                  disabled={!editable}
                  onCommit={(score) => setScore(team.id, score)}
                />
              </View>
              {calcFor === team.id && editable && (
                <ScoreCalculator
                  onApply={(score) => {
                    setScore(team.id, score)
                    setCalcFor(null)
                  }}
                  onClose={() => setCalcFor(null)}
                />
              )}
            </View>
          )
        })}

        {!isHost && (
          <Muted className="text-center">
            Enter your team's round total. The host can fix any team's score.
          </Muted>
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
          {sortedTeams.map((team) => {
            const label = teamLabel(team, session.players)
            const members = team.playerIds
              .map((id) => playerOf(id)?.name)
              .filter(Boolean)
              .join(', ')
            return (
              <View
                key={team.id}
                className="flex-row flex-wrap items-center gap-1.5 border-t border-line pt-2"
              >
                <View className="mr-1 w-28">
                  <Text className="text-sm text-zinc-100" numberOfLines={1}>
                    {label}
                  </Text>
                  {members ? (
                    <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
                      {members}
                    </Text>
                  ) : null}
                </View>
                {game.rounds.map((r, idx) => {
                  const score = r.scores[team.id]
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
                  {totals[team.id] ?? 0}
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
  const sorted = [...game.teams].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0))

  return (
    <Card className="gap-3 p-4">
      <CardTitle>Scoresheet</CardTitle>
      {sorted.map((team) => {
        const label = teamLabel(team, session.players)
        const members = team.playerIds
          .map((id) => {
            const p = playerOf(id)
            return p ? `${p.emoji} ${p.name}` : null
          })
          .filter(Boolean)
          .join(' · ')
        return (
          <View key={team.id} className="rounded-xl border border-line p-3">
            <View className="flex-row items-center gap-2">
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-zinc-100">{label}</Text>
                {members ? (
                  <Text className="text-[11px] text-muted-foreground">{members}</Text>
                ) : null}
              </View>
              <Text className="font-mono text-xl font-bold text-primary">
                {totals[team.id] ?? 0}
              </Text>
            </View>
            <Text className="mt-1 font-mono text-xs text-muted-foreground">
              {game.rounds
                .map((r) =>
                  typeof r.scores[team.id] === 'number' ? String(r.scores[team.id]) : '·',
                )
                .join(' · ')}
            </Text>
          </View>
        )
      })}
      <Muted className="text-center">
        {game.rounds.length} {game.rounds.length === 1 ? 'round' : 'rounds'} · first to{' '}
        {game.config.targetScore} · {playersPerTeamSummary(game.config.playersPerTeam ?? 2)}
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
    return [`First to ${c.targetScore}`, playersPerTeamSummary(c.playersPerTeam ?? 2)]
  },
}
