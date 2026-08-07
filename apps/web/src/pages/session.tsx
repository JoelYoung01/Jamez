import {
  getGameEngine,
  normalizeJoinCode,
  sessionDisplayName,
  SESSION_NICKNAME_MAX,
  type SessionPlayer,
  type SessionState,
} from '@jamez/core'
import {
  CircleHelpIcon,
  DoorClosedIcon,
  FlagIcon,
  HandIcon,
  Loader2Icon,
  LogOutIcon,
  MedalIcon,
  MoonIcon,
  PencilIcon,
  PlayIcon,
  RotateCcwIcon,
  TrophyIcon,
  UserPlusIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmojiPicker } from '@/components/emoji-picker'
import { PlayerAvatar } from '@/components/player-avatar'
import { QrCard } from '@/components/qr-card'
import { StatusPill } from '@/components/status-pill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getGameIcon, getGameUI } from '@/games/registry'
import { randomEmoji, useProfile } from '@/lib/profile'
import { sessionIsOngoing, useSession } from '@/lib/session-store'
import { cn } from '@/lib/utils'

export function SessionPage() {
  const { code: codeParam = '' } = useParams()
  const code = normalizeJoinCode(codeParam)
  const navigate = useNavigate()
  const store = useSession()

  // Attach to this session: resume hosting if we have a snapshot for the
  // code, otherwise join as a guest. Refresh-safe on both roles.
  React.useEffect(() => {
    if (!code) {
      navigate('/join', { replace: true })
      return
    }
    if (store.code === code && store.role) return
    if (!store.resumeHost(code)) store.joinGame(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (!code) return null
  const { role, state } = store

  if (!role || store.code !== code) {
    return <ConnectingCard code={code} label="Setting up…" />
  }

  if (role === 'guest') {
    const status = store.guestStatus
    if (status === 'rejected') {
      return (
        <StatusCard
          icon={DoorClosedIcon}
          title="Couldn't join"
          body="The host turned this request down. The session may be full or already running."
          action={<BackHomeButton onClick={() => store.leaveSession()} />}
        />
      )
    }
    if (status === 'removed') {
      return (
        <StatusCard
          icon={HandIcon}
          title="You were removed"
          body="The host removed you from this session."
          action={<BackHomeButton onClick={() => store.leaveSession()} />}
        />
      )
    }
    if (status === 'ended') {
      return (
        <StatusCard
          icon={MoonIcon}
          title="Session ended"
          body="The host wrapped up this session. Finished games are saved in your history."
          action={<BackHomeButton onClick={() => store.leaveSession()} />}
        />
      )
    }
    if (!state || status === 'connecting' || status === 'waiting_host') {
      return <ConnectingCard code={code} label="Looking for the host…" waiting />
    }
  }

  if (!state) return <ConnectingCard code={code} label="Loading session…" />

  return (
    <div className="grid gap-4">
      <SessionHeader state={state} />
      {role === 'guest' && store.guestStatus === 'host_lost' && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <Loader2Icon className="size-4 animate-spin" />
          Host went quiet. Hang tight, we'll resync the moment they're back.
        </div>
      )}
      {state.phase === 'lobby' && <LobbyView />}
      {state.phase === 'playing' && <PlayingView />}
      {state.phase === 'finished' && <FinishedView />}
    </div>
  )
}

function SessionHeader({ state }: { state: SessionState }) {
  const store = useSession()
  const game = getGameEngine(state.gameId)
  const GameIcon = getGameIcon(state.gameId)
  const title = sessionDisplayName({ nickname: state.nickname, gameId: state.gameId })
  const isHost = store.role === 'host'
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <GameIcon className="size-6 shrink-0" style={{ color: game?.accentColor }} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="truncate font-semibold leading-tight">{title}</div>
            {isHost && <NicknameDialog state={state} />}
          </div>
          <div className="font-mono text-xs tracking-widest text-muted-foreground">
            {state.nickname ? `${game?.name ?? state.gameId} · ` : null}
            {state.code}
          </div>
        </div>
      </div>
      <StatusPill transportStatus={store.transportStatus} passAndPlay={store.passAndPlay} />
    </div>
  )
}

function NicknameDialog({ state }: { state: SessionState }) {
  const setNickname = useSession((s) => s.setNickname)
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(state.nickname ?? '')

  React.useEffect(() => {
    if (open) setDraft(state.nickname ?? '')
  }, [open, state.nickname])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit nickname"
          className="shrink-0 text-muted-foreground"
        >
          <PencilIcon className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session nickname</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="session-nickname">Nickname (optional)</Label>
          <Input
            id="session-nickname"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, SESSION_NICKNAME_MAX))}
            placeholder="e.g. Friday night bank"
            maxLength={SESSION_NICKNAME_MAX}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setNickname(draft)
                setOpen(false)
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setNickname('')
              setOpen(false)
            }}
          >
            Clear
          </Button>
          <Button
            onClick={() => {
              setNickname(draft)
              setOpen(false)
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConnectingCard({ code, label, waiting }: { code: string; label: string; waiting?: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2Icon className="size-8 animate-spin text-primary" />
        <div>
          <div className="font-medium">{label}</div>
          <div className="mt-1 font-mono text-sm tracking-widest text-muted-foreground">{code}</div>
        </div>
        {waiting && (
          <p className="max-w-xs text-xs text-muted-foreground/70">
            Make sure the host's session is open and you're both online (or on the same custom
            relay). Codes expire when the host closes the session.
          </p>
        )}
        <Button asChild variant="ghost" size="sm">
          <Link to="/">Cancel</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function StatusCard({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Icon className="size-10 text-muted-foreground" />
        <div className="text-lg font-semibold">{title}</div>
        <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
        {action}
      </CardContent>
    </Card>
  )
}

function BackHomeButton({ onClick }: { onClick?: () => void }) {
  const navigate = useNavigate()
  return (
    <Button
      onClick={() => {
        onClick?.()
        navigate('/')
      }}
    >
      Back home
    </Button>
  )
}

function PlayerRow({ player, canKick, onKick }: { player: SessionPlayer; canKick: boolean; onKick: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2">
      <PlayerAvatar player={player} size="sm" showPresence />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>
      {player.isHost && <Badge variant="secondary">host</Badge>}
      {!player.remote && !player.isHost && <Badge variant="outline">local</Badge>}
      {canKick && (
        <Button variant="ghost" size="icon-sm" onClick={onKick} aria-label={`Remove ${player.name}`}>
          <XIcon className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

function AddLocalPlayerDialog() {
  const addLocalPlayer = useSession((s) => s.addLocalPlayer)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [emoji, setEmoji] = React.useState(randomEmoji())

  const add = () => {
    if (!name.trim()) return
    addLocalPlayer({ name: name.trim(), emoji })
    setName('')
    setEmoji(randomEmoji())
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlusIcon /> Add local player
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a local player</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="local-name">Name</Label>
            <Input
              id="local-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grandma"
              maxLength={24}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </div>
          <div className="grid gap-2">
            <Label>Emoji</Label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={add} disabled={!name.trim()}>
            Add player
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LobbyView() {
  const store = useSession()
  const state = store.state!
  const isHost = store.role === 'host'
  const game = getGameEngine(state.gameId)
  const ui = getGameUI(state.gameId)
  const summary = ui?.configSummary?.(state.gameConfig) ?? []
  const canStart = state.players.length >= (game?.minPlayers ?? 1)

  return (
    <div className="grid gap-4">
      {isHost && !store.passAndPlay && (
        <Card>
          <CardContent className="pt-5">
            <QrCard code={state.code} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">
              Players ({state.players.length}
              {game ? `/${game.maxPlayers}` : ''})
            </CardTitle>
            {summary.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {summary.map((chip) => (
                  <Badge key={chip} variant="outline" className="text-[10px]">
                    {chip}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {isHost && <AddLocalPlayerDialog />}
        </CardHeader>
        <CardContent className="grid gap-2">
          {state.players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              canKick={isHost && !player.isHost}
              onKick={() => store.removePlayer(player.id)}
            />
          ))}
          {state.players.length === 1 && !store.passAndPlay && (
            <p className="py-2 text-center text-xs text-muted-foreground/70">
              Waiting for friends… they can scan the QR or enter the code at this site.
            </p>
          )}
        </CardContent>
      </Card>

      {isHost ? (
        <Button size="lg" onClick={() => store.startGame()} disabled={!canStart}>
          <PlayIcon />
          {canStart
            ? sessionIsOngoing(state)
              ? 'Open the bank'
              : 'Start the game'
            : `Need ${game?.minPlayers ?? 1}+ players to start`}
        </Button>
      ) : (
        <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Waiting for the host to start…
        </p>
      )}
      {isHost && <HostSessionControls />}
    </div>
  )
}

function PlayingView() {
  const store = useSession()
  const state = store.state!
  const isHost = store.role === 'host'
  const profileId = useProfile((s) => s.playerId)
  const ui = getGameUI(state.gameId)
  const me = state.players.find((p) => p.id === profileId) ?? null

  if (!ui) return <StatusCard icon={CircleHelpIcon} title="Unsupported game" body="This app version doesn't know this game yet. Update and rejoin." />
  const PlayView = ui.PlayView

  const ongoing = sessionIsOngoing(state)

  return (
    <div className="grid gap-4">
      <PlayView
        state={state}
        me={me}
        isHost={isHost}
        send={(action, actorId) => store.sendAction(action, actorId) ?? null}
      />
      {isHost && (
        <div className="grid gap-2">
          {!ongoing && (
            <Button variant="secondary" onClick={() => store.finishGame()}>
              <FlagIcon /> Finish & reveal results
            </Button>
          )}
          <HostSessionControls />
        </div>
      )}
    </div>
  )
}

function FinishedView() {
  const store = useSession()
  const state = store.state!
  const isHost = store.role === 'host'
  const navigate = useNavigate()
  const ui = getGameUI(state.gameId)
  const summary = state.summary
  if (!summary) return null

  const medal = (rank: number) =>
    rank <= 3 ? (
      <MedalIcon
        className={cn(
          'mx-auto size-5',
          rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-zinc-300' : 'text-amber-600',
        )}
      />
    ) : (
      `#${rank}`
    )

  return (
    <div className="grid gap-4">
      <Card className="border-primary/40 bg-gradient-to-b from-primary/15 to-transparent">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <TrophyIcon className="size-8 text-primary" />
          <div className="text-xl font-bold tracking-tight">{summary.headline}</div>
          <CardDescription>Saved to everyone's local history</CardDescription>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-2 pt-5">
          {summary.entries.map((entry) => {
            const player = state.players.find((p) => p.id === entry.playerId)
            if (!player) return null
            const winner = summary.winnerIds.includes(entry.playerId)
            return (
              <div
                key={entry.playerId}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                  winner ? 'border-primary/50 bg-primary/10' : 'border-border/50 bg-background/40',
                )}
              >
                <span className="w-8 text-center text-lg">{medal(entry.rank)}</span>
                <PlayerAvatar player={player} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                  {entry.scoreText}
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {ui?.ResultsDetail && <ui.ResultsDetail state={state} />}

      <div className="grid gap-2">
        {isHost && (
          <Button size="lg" onClick={() => store.rematch()}>
            <RotateCcwIcon /> Rematch
          </Button>
        )}
        {isHost ? (
          <HostSessionControls />
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              store.leaveSession()
              navigate('/')
            }}
          >
            <LogOutIcon /> Leave session
          </Button>
        )}
      </div>
    </div>
  )
}

function HostSessionControls() {
  const store = useSession()
  const navigate = useNavigate()
  const ongoing = sessionIsOngoing(store.state)
  const [mode, setMode] = React.useState<'idle' | 'park' | 'end'>('idle')

  if (mode === 'idle') {
    return (
      <div className="grid gap-2">
        {ongoing && (
          <Button onClick={() => setMode('park')}>
            <MoonIcon /> Close for now
          </Button>
        )}
        <Button variant="destructive" onClick={() => setMode('end')}>
          <LogOutIcon /> {ongoing ? 'Dissolve bank' : 'End session for everyone'}
        </Button>
      </div>
    )
  }

  if (mode === 'park') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => {
            store.parkSession()
            navigate('/')
          }}
        >
          Yes, park it
        </Button>
        <Button variant="outline" onClick={() => setMode('idle')}>
          Keep open
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="destructive"
        onClick={() => {
          store.endSession()
          navigate('/')
        }}
      >
        {ongoing ? 'Yes, dissolve' : 'Yes, end it'}
      </Button>
      <Button variant="secondary" onClick={() => setMode('idle')}>
        Keep playing
      </Button>
    </div>
  )
}
