import {
  HAND_AND_FOOT_CLEAN_BOOK,
  HAND_AND_FOOT_DIRTY_BOOK,
  HAND_AND_FOOT_GOING_OUT,
  HAND_AND_FOOT_RED_THREE,
  HAND_AND_FOOT_WILD_BOOK,
  handAndFootRoundComplete,
  handAndFootTotals,
  scoreHandAndFootRound,
  teamLabel,
  type HandAndFootConfig,
  type HandAndFootState,
  type HandAndFootTeam,
  type SessionState,
} from '@jamez/core'
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
} from 'lucide-react'
import * as React from 'react'
import { AddLocalPlayerDialog } from '@/components/add-local-player-dialog'
import { PlayerAvatar } from '@/components/player-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { useSession } from '@/lib/session-store'
import { cn } from '@/lib/utils'
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
    <div className="grid gap-3">
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
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Players per team</Label>
        <Segmented
          value={String(playersPerTeam) as '1' | '2' | '3'}
          onChange={(v) => onChange({ ...config, playersPerTeam: Number(v) })}
          options={[
            { value: '1', label: 'Cutthroat (1)' },
            { value: '2', label: 'Partners (2)' },
            { value: '3', label: 'Trios (3)' },
          ]}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Common Hand &amp; Foot races to 10,000. People are grouped into teams of{' '}
        {playersPerTeam} at the start; each score column is a team. Use the book
        calculator to tally a deal.
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
    <Card className="border-[#d4524a]/30">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Round calculator</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
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
              onClose()
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

function TeamAvatars({
  team,
  playerOf,
}: {
  team: HandAndFootTeam
  playerOf: (id: string) => SessionState['players'][number] | undefined
}) {
  return (
    <div className="flex shrink-0 items-center">
      {team.playerIds.map((id, i) => {
        const player = playerOf(id)
        if (!player) return null
        return (
          <div key={id} className={cn(i > 0 && '-ml-2')}>
            <PlayerAvatar player={player} size="sm" showPresence />
          </div>
        )
      })}
    </div>
  )
}

/** Host pencil → dialog to rename, move, add, or remove players. */
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
      <div className="flex min-w-0 items-center gap-1">
        <div className="truncate text-sm font-medium">{label}</div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 px-0 text-muted-foreground"
          aria-label={`Edit ${label}`}
          onClick={() => setOpen(true)}
        >
          <PencilIcon className="size-3.5" />
        </Button>
      </div>
      <TeamEditDialog
        teamId={team.id}
        game={game}
        players={players}
        open={open}
        onOpenChange={setOpen}
        send={send}
      />
    </>
  )
}

function TeamEditDialog({
  teamId,
  game,
  players,
  open,
  onOpenChange,
  send,
}: {
  teamId: string
  game: HandAndFootState
  players: SessionState['players']
  open: boolean
  onOpenChange: (open: boolean) => void
  send: GamePlayProps['send']
}) {
  const removePlayer = useSession((s) => s.removePlayer)
  const team = game.teams.find((t) => t.id === teamId)
  const fallback = team ? teamLabel({ ...team, name: undefined }, players) : 'Team'
  const [text, setText] = React.useState(team?.name ?? '')
  const [adding, setAdding] = React.useState(false)

  React.useEffect(() => {
    if (open) setText(team?.name ?? '')
  }, [open, team?.name, teamId])

  React.useEffect(() => {
    if (open && !team) onOpenChange(false)
  }, [open, team, onOpenChange])

  if (!team) return null

  const commitName = () => {
    const next = text.trim().slice(0, 24)
    const current = (team.name ?? '').trim()
    if (next !== current) send({ type: 'setTeamName', teamId: team.id, name: next })
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
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) commitName()
          onOpenChange(next)
          if (!next) setAdding(false)
        }}
      >
        <DialogContent keyboardAvoid className="max-h-[min(90vh,40rem)] gap-0 overflow-y-auto p-0">
          <DialogHeader className="border-b border-border/50 p-5 pb-4">
            <DialogTitle>Edit team</DialogTitle>
            <DialogDescription>
              Rename this team, move people around, or add someone new.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 p-5">
            <div className="grid gap-2">
              <Label htmlFor={`team-name-${team.id}`}>Team name</Label>
              <Input
                id={`team-name-${team.id}`}
                maxLength={24}
                placeholder={fallback}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 24))}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to use member names ({fallback}).
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Members</Label>
              {team.playerIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one on this team yet.</p>
              ) : (
                <div className="grid gap-2">
                  {team.playerIds.map((playerId) => {
                    const player = players.find((p) => p.id === playerId)
                    if (!player) return null
                    return (
                      <div
                        key={playerId}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2"
                      >
                        <span className="text-base leading-none" aria-hidden>
                          {player.emoji}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {player.name}
                        </span>
                        {otherTeams.length > 0 && (
                          <select
                            className="max-w-[9rem] truncate rounded-md border border-border/60 bg-transparent px-1.5 py-1 text-[11px] text-muted-foreground"
                            value=""
                            aria-label={`Move ${player.name} to another team`}
                            onChange={(e) => {
                              const next = e.target.value
                              if (next) send({ type: 'movePlayer', playerId, teamId: next })
                              e.currentTarget.value = ''
                            }}
                          >
                            <option value="" disabled>
                              Move to…
                            </option>
                            {otherTeams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {teamLabel(t, players)}
                              </option>
                            ))}
                          </select>
                        )}
                        {team.playerIds.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-[11px]"
                            onClick={() => send({ type: 'splitPlayer', playerId })}
                          >
                            <UsersIcon className="size-3.5" /> Own team
                          </Button>
                        )}
                        {!player.isHost && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[11px] text-destructive"
                            aria-label={`Remove ${player.name} from the game`}
                            onClick={() => removePlayer(playerId)}
                          >
                            <UserMinusIcon className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Add to this team</Label>
              {recruits.length > 0 ? (
                <div className="grid gap-1.5">
                  {recruits.map(({ playerId, fromTeam, player }) => {
                    if (!player) return null
                    return (
                      <button
                        key={playerId}
                        type="button"
                        onClick={() => send({ type: 'movePlayer', playerId, teamId: team.id })}
                        className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                      >
                        <span className="text-base leading-none" aria-hidden>
                          {player.emoji}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {player.name}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          from {teamLabel(fromTeam, players)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Everyone else is already on this team (or there are no other teams yet).
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => {
                  commitName()
                  setAdding(true)
                }}
              >
                <UserPlusIcon className="size-3.5" /> Add new player
              </Button>
            </div>
          </div>

          <DialogFooter className="border-t border-border/50 p-4">
            <Button
              type="button"
              onClick={() => {
                commitName()
                onOpenChange(false)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddLocalPlayerDialog
        showTrigger={false}
        open={adding}
        onOpenChange={setAdding}
        title="Add player to team"
        confirmLabel="Add to team"
        keyboardAvoid
        onAdded={(profile) => {
          send({ type: 'movePlayer', playerId: profile.id, teamId: team.id })
        }}
      />
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
    <div className="grid gap-3">
      <div className="grid gap-2">
        {sortedTeams.map((team) => {
          const total = totals[team.id] ?? 0
          const progress = Math.min(1, Math.max(0, total / Math.max(1, game.config.targetScore)))
          const label = teamLabel(team, session.players)
          return (
            <Card key={team.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <TeamAvatars team={team} playerOf={playerOf} />
                <div className="min-w-0 flex-1">
                  {isHost ? (
                    <TeamEditControl
                      team={team}
                      game={game}
                      players={session.players}
                      send={send}
                    />
                  ) : (
                    <div className="truncate text-sm font-medium">{label}</div>
                  )}
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {team.playerIds
                      .map((id) => playerOf(id)?.name)
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
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
          {game.teams.map((team) => {
            const editable = canEdit(team)
            const label = teamLabel(team, session.players)
            return (
              <div key={team.id} className="grid grid-cols-[1fr_7.5rem] items-start gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamAvatars team={team} playerOf={playerOf} />
                    {isHost ? (
                      <div className="min-w-0 flex-1">
                        <TeamEditControl
                          team={team}
                          game={game}
                          players={session.players}
                          send={send}
                        />
                      </div>
                    ) : (
                      <span className="truncate text-sm font-medium">{label}</span>
                    )}
                    {editable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-8 shrink-0 px-2 text-xs text-muted-foreground"
                        aria-label={`Calculate ${label}'s round score`}
                        onClick={() => setCalcFor(calcFor === team.id ? null : team.id)}
                      >
                        <CalculatorIcon className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5 pl-1">
                    {team.playerIds.map((playerId) => {
                      const player = playerOf(playerId)
                      if (!player) return null
                      return (
                        <div
                          key={playerId}
                          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                        >
                          <span>{player.emoji}</span>
                          <span className="truncate">{player.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <RoundScoreField
                  value={round.scores[team.id] ?? null}
                  disabled={!editable}
                  onCommit={(score) => setScore(team.id, score)}
                />
                {calcFor === team.id && editable && (
                  <div className="col-span-2">
                    <ScoreCalculator
                      onApply={(score) => {
                        setScore(team.id, score)
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
              Enter your team&apos;s round total. The host can fix any team&apos;s score.
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
                  <th className="pb-2 pr-2 font-medium">Team</th>
                  {game.rounds.map((r) => (
                    <th key={r.n} className="pb-2 px-1 text-center font-medium">
                      R{r.n}
                    </th>
                  ))}
                  <th className="pb-2 pl-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeams.map((team) => {
                  const label = teamLabel(team, session.players)
                  const members = team.playerIds
                    .map((id) => playerOf(id)?.name)
                    .filter(Boolean)
                    .join(', ')
                  return (
                    <tr key={team.id} className="border-t border-border/40">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{label}</div>
                        {members ? (
                          <div className="text-[11px] text-muted-foreground">{members}</div>
                        ) : null}
                      </td>
                      {game.rounds.map((r, idx) => {
                        const score = r.scores[team.id]
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
                        {totals[team.id] ?? 0}
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
  const sorted = [...game.teams].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Scoresheet</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-2 font-medium">Team</th>
              {game.rounds.map((r) => (
                <th key={r.n} className="pb-2 px-1 text-center font-medium">
                  R{r.n}
                </th>
              ))}
              <th className="pb-2 pl-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
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
                <tr key={team.id} className="border-t border-border/40">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{label}</div>
                    {members ? (
                      <div className="text-[11px] text-muted-foreground">{members}</div>
                    ) : null}
                  </td>
                  {game.rounds.map((r) => (
                    <td key={r.n} className="px-1 py-2 text-center font-mono tabular-nums">
                      {typeof r.scores[team.id] === 'number' ? r.scores[team.id] : '·'}
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right font-mono text-lg font-bold tabular-nums text-primary">
                    {totals[team.id] ?? 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-3 text-center text-xs text-muted-foreground/70">
          {game.rounds.length} {game.rounds.length === 1 ? 'round' : 'rounds'} · first to{' '}
          {game.config.targetScore} · {playersPerTeamSummary(game.config.playersPerTeam ?? 2)}
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
    return [`First to ${c.targetScore}`, playersPerTeamSummary(c.playersPerTeam ?? 2)]
  },
}
