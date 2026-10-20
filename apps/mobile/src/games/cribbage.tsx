import {
  CRIBBAGE_PEG_KIND_LABELS,
  CRIBBAGE_QUICK_PEGS,
  CRIBBAGE_RANKS,
  CRIBBAGE_SUITS,
  clampCribbageTeamCount,
  cribbageIsSkunk,
  cribbageSideLabel,
  cribbageSides,
  cribbageTotals,
  isPlayerActive,
  normalizeCribbageTeams,
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
import { PanResponder, Pressable, Switch, Text, View } from 'react-native'
import { AppTextInput } from '@/components/app-text-input'
import { PlayerAvatar } from '@/components/player-avatar'
import { Segmented } from '@/components/segmented'
import { AppButton, Card, SectionLabel } from '@/components/ui'
import type { GameLobbyProps, GamePlayProps, GameSetupProps, GameUIModule } from './types'

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
              ...config,
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
          Bicycle: first to {config.targetScore}. Every losing side still below {config.skunkLine}{' '}
          when the winner pegs out is lurched (double game).
        </Text>
      </View>
      <View className="gap-1.5">
        <Text className="text-xs text-muted-foreground">Teams</Text>
        <Segmented
          value={clampCribbageTeamCount(config.teamCount) === 3 ? '3' : '2'}
          onChange={(value) => {
            const teamCount = value === '3' ? 3 : 2
            onChange({ ...config, teamCount, teams: undefined })
          }}
          options={[
            { value: '2', label: '2 teams' },
            { value: '3', label: '3 teams' },
          ]}
        />
        <Text className="text-xs text-muted-foreground">
          Each team keeps one peg and seats one or two players. Two teams is the classic game (up
          to 4). Three teams seats up to 6. You fill the teams in the lobby.
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
        {game.playerIds.length > 2 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {game.playerIds.map((id) => {
              const allowed = canPegFor(id)
              const selected = id === playerId
              return (
                <Pressable
                  key={id}
                  disabled={!allowed}
                  onPress={() => {
                    if (!allowed) return
                    setPlayerOverride(id)
                  }}
                  className={clsx(
                    'rounded-full border px-2.5 py-1',
                    selected ? 'border-emerald-400/50 bg-emerald-400/15' : 'border-line bg-field',
                    !allowed && 'opacity-40',
                  )}
                >
                  <Text className={clsx('text-xs', selected ? 'text-emerald-100' : 'text-muted-foreground')}>
                    {playerOf(id)?.emoji ?? ''} {playerOf(id)?.name ?? '?'}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : (
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
        )}
        {cribbageSides(game).some((side) => side.playerIds.length > 1) && (
          <Text className="text-xs text-muted-foreground">
            Points peg on the partnership, whoever at the table scored them.
          </Text>
        )}
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
  const sides = cribbageSides(game)
  const partnership = sides.some((side) => side.playerIds.length > 1)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const skunked = cribbageIsSkunk(game)

  return (
    <View className="gap-3">
      <View className={clsx('gap-3', sides.length > 2 ? 'flex-col' : 'flex-row')}>
        {sides.map((side) => {
          const total = totals[side.id] ?? 0
          const progress = Math.min(1, total / game.config.targetScore)
          const skunkProgress = Math.min(1, game.config.skunkLine / game.config.targetScore)
          const dealerHere = !!game.dealerId && side.playerIds.includes(game.dealerId)
          const role =
            sides.length === 2
              ? dealerHere
                ? 'dealer · crib'
                : 'pone'
              : dealerHere
                ? 'dealer · crib'
                : 'non-dealer'
          return (
            <Card
              key={side.id}
              className={clsx('flex-1 items-center gap-1 p-4', dealerHere && 'border-primary/40')}
            >
              <View className="flex-row items-start justify-center gap-3">
                {side.playerIds.map((id) => {
                  const player = playerOf(id)
                  if (!player) return null
                  const isDealer = game.dealerId === id
                  const body = (
                    <>
                      <PlayerAvatar player={player} showPresence />
                      <Text className="max-w-24 text-sm font-medium text-zinc-100" numberOfLines={1}>
                        {player.name}
                      </Text>
                      {partnership && (
                        <Text className="text-[10px] text-muted-foreground">
                          {isDealer ? 'dealer' : dealerHere ? 'partner' : 'opponent'}
                        </Text>
                      )}
                    </>
                  )
                  if (!isHost || isDealer) {
                    return (
                      <View key={id} className="items-center gap-1">
                        {body}
                      </View>
                    )
                  }
                  return (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${player.name} as dealer`}
                      onPress={() => send({ type: 'setDealer', playerId: id })}
                      className="items-center gap-1 active:opacity-80"
                    >
                      {body}
                    </Pressable>
                  )
                })}
              </View>
              <Text className="font-mono text-4xl font-bold text-zinc-100">{total}</Text>
              <Text className="text-xs text-muted-foreground">{role}</Text>
              <View className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <View
                  className="absolute inset-y-0 w-px bg-amber-400/80"
                  style={{ left: `${skunkProgress * 100}%` }}
                />
                <View className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
              </View>
            </Card>
          )
        })}
      </View>
      {(partnership || sides.length > 2) && (
        <Text className="text-center text-xs text-muted-foreground">
          {sides.map((side) => cribbageSideLabel(side, session.players)).join(' vs ')}
        </Text>
      )}
      <View className="flex-row flex-wrap items-center justify-center gap-2">
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
  const sorted = [...cribbageSides(game)].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0))
  const best = sorted[0] ? (totals[sorted[0].id] ?? 0) : 0

  return (
    <Card className="gap-3 p-4">
      <Text className="text-sm font-semibold text-zinc-100">Final board</Text>
      {sorted.map((side) => {
        const members = side.playerIds.map((id) => playerOf(id)).filter((p) => !!p)
        const score = totals[side.id] ?? 0
        const winner = score === best && score >= game.config.targetScore
        return (
          <View key={side.id} className="rounded-xl border border-line p-3">
            <View className="flex-row items-center gap-2">
              <Text>{members.map((player) => player.emoji).join(' ')}</Text>
              <Text className="flex-1 text-sm font-medium text-zinc-100">
                {members.map((player) => player.name).join(' & ')}
              </Text>
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

function DragSeat({
  label,
  enabled,
  onGrant,
  onMovePoint,
  onEnd,
}: {
  label: string
  enabled: boolean
  onGrant: () => void
  onMovePoint: (x: number, y: number) => void
  onEnd: (x: number, y: number) => void
}) {
  const enabledRef = React.useRef(enabled)
  const grantRef = React.useRef(onGrant)
  const moveRef = React.useRef(onMovePoint)
  const endRef = React.useRef(onEnd)
  enabledRef.current = enabled
  grantRef.current = onGrant
  moveRef.current = onMovePoint
  endRef.current = onEnd
  const [shift, setShift] = React.useState({ x: 0, y: 0, active: false })
  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabledRef.current,
        onMoveShouldSetPanResponder: () => enabledRef.current,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          setShift({ x: 0, y: 0, active: true })
          grantRef.current()
        },
        onPanResponderMove: (_event, gesture) => {
          setShift({ x: gesture.dx, y: gesture.dy, active: true })
          moveRef.current(gesture.moveX, gesture.moveY)
        },
        onPanResponderRelease: (_event, gesture) => {
          setShift({ x: 0, y: 0, active: false })
          endRef.current(gesture.moveX, gesture.moveY)
        },
        onPanResponderTerminate: () => setShift({ x: 0, y: 0, active: false }),
      }),
    [],
  )

  return (
    <View
      {...(enabled ? responder.panHandlers : {})}
      style={{
        transform: [{ translateX: shift.x }, { translateY: shift.y }],
        zIndex: shift.active ? 20 : 0,
        elevation: shift.active ? 8 : 0,
      }}
      className={clsx(
        'flex-row items-center rounded-lg border border-line bg-field px-2 py-1.5',
        shift.active && 'border-emerald-400/70',
      )}
    >
      <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

function CribbageLobby({ state, isHost, updateConfig }: GameLobbyProps) {
  const config = state.gameConfig as CribbageConfig
  const teamCount = clampCribbageTeamCount(config.teamCount)
  const atTable = state.players.filter(isPlayerActive)
  const teams = normalizeCribbageTeams(
    teamCount,
    config.teams,
    atTable.map((player) => player.id),
  )
  const playerOf = (id: string) => state.players.find((player) => player.id === id)
  const teamNodes = React.useRef<(View | null)[]>([])
  const layouts = React.useRef<Array<{ x: number; y: number; width: number; height: number } | null>>([])
  const teamsRef = React.useRef(teams)
  const configRef = React.useRef(config)
  teamsRef.current = teams
  configRef.current = config
  const [over, setOver] = React.useState<number | null>(null)
  const [draggingId, setDraggingId] = React.useState<string | null>(null)

  const remeasure = React.useCallback(() => {
    teamNodes.current.forEach((node, index) => {
      node?.measureInWindow((x, y, width, height) => {
        layouts.current[index] = { x, y, width, height }
      })
    })
  }, [])

  const teamAt = React.useCallback((x: number, y: number) => {
    for (let i = 0; i < layouts.current.length; i++) {
      const rect = layouts.current[i]
      if (!rect) continue
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return i
    }
    return null
  }, [])

  const commitMove = React.useCallback(
    (playerId: string, teamIndex: number) => {
      const current = teamsRef.current
      const from = current.findIndex((team) => team.includes(playerId))
      if (from === teamIndex) return
      if ((current[teamIndex]?.length ?? 2) >= 2) return
      const next = current.map((team) => team.filter((id) => id !== playerId))
      next[teamIndex]!.push(playerId)
      updateConfig({ ...configRef.current, teamCount, teams: next })
    },
    [teamCount, updateConfig],
  )

  return (
    <Card className="gap-3 p-4">
      <Text className="text-sm font-semibold text-zinc-100">Teams</Text>
      <Text className="text-xs text-muted-foreground">
        {teamCount} teams, up to two players each. People sit as they join.
        {isHost ? ' Drag a player onto another team before the deal.' : ''}
      </Text>
      <View className="gap-2">
        {teams.map((team, index) => {
          const full = team.length >= 2 && !team.includes(draggingId ?? '')
          const hot = over === index
          return (
            <View
              key={index}
              ref={(node) => {
                teamNodes.current[index] = node
              }}
              onLayout={remeasure}
              className={clsx(
                'min-h-16 rounded-xl border p-3',
                hot && !full && 'border-emerald-400 bg-emerald-400/10',
                hot && full && 'border-rose-400/70 bg-rose-400/10',
                !hot && 'border-line',
              )}
            >
              <Text className="text-xs font-medium text-muted-foreground">
                Team {index + 1}
                {hot && full ? ' · full' : ''}
              </Text>
              {team.length === 0 && (
                <Text className="mt-2 text-sm text-muted-foreground">
                  {hot && !full ? 'Drop here' : 'Empty'}
                </Text>
              )}
              <View className="mt-2 gap-2">
                {team.map((id) => {
                  const person = playerOf(id)
                  return (
                    <DragSeat
                      key={id}
                      label={`${person?.emoji ?? ''} ${person?.name ?? 'Unknown'}`}
                      enabled={isHost}
                      onGrant={() => {
                        remeasure()
                        setDraggingId(id)
                      }}
                      onMovePoint={(x, y) => setOver(teamAt(x, y))}
                      onEnd={(x, y) => {
                        const dest = teamAt(x, y)
                        setOver(null)
                        setDraggingId(null)
                        if (dest !== null) commitMove(id, dest)
                      }}
                    />
                  )
                })}
              </View>
            </View>
          )
        })}
      </View>
    </Card>
  )
}

export const cribbageUI: GameUIModule = {
  id: 'cribbage',
  icon: CircleDotIcon,
  SetupForm: CribbageSetup as GameUIModule['SetupForm'],
  LobbyPanel: CribbageLobby,
  PlayView: CribbagePlay,
  ResultsDetail: CribbageResults,
  configSummary: (config) => {
    const c = config as CribbageConfig
    const teams = clampCribbageTeamCount(c.teamCount)
    return [`First to ${c.targetScore}`, `Skunk below ${c.skunkLine}`, `${teams} teams`]
  },
}
