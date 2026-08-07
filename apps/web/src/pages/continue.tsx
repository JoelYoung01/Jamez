import { getGameEngine, sessionDisplayName } from '@jamez/core'
import { ArrowLeftIcon, MoreHorizontalIcon, MoonIcon, SearchIcon } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGameIcon } from '@/games/registry'
import { QrCard } from '@/components/qr-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useHistory } from '@/lib/history'
import { listLongTermSessions, type LongTermRoom } from '@/lib/long-term-sessions'
import {
  archiveParkedSession,
  clearHostSnapshotAsync,
  listHostSnapshots,
  useSession,
} from '@/lib/session-store'
import { formatDate } from '@/lib/utils'

function roomMatchesFilter(room: LongTermRoom, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const game = getGameEngine(room.gameId)
  const title = sessionDisplayName({
    nickname: room.nickname,
    gameId: room.gameId,
  })
  return (
    title.toLowerCase().includes(q) ||
    room.code.toLowerCase().includes(q) ||
    (game?.name.toLowerCase().includes(q) ?? false) ||
    (room.nickname?.toLowerCase().includes(q) ?? false)
  )
}

export function ContinuePage() {
  const navigate = useNavigate()
  const history = useHistory()
  const activeCode = useSession((s) => s.code)
  const state = useSession((s) => s.state)
  const endSession = useSession((s) => s.endSession)
  const discardSession = useSession((s) => s.discardSession)
  const [vaultTick, setVaultTick] = React.useState(0)
  const vault = React.useMemo(
    () => listHostSnapshots(),
    [vaultTick, activeCode, state?.nickname, history],
  )
  const [menuKey, setMenuKey] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState('')
  const [showEnded, setShowEnded] = React.useState(false)
  const [inviteRoom, setInviteRoom] = React.useState<LongTermRoom | null>(null)

  const rooms = listLongTermSessions(
    vault,
    {
      code: activeCode ?? '',
      gameId: state?.gameId ?? '',
      nickname: state?.nickname,
    },
    { includeEnded: showEnded, history },
  )
  const openCount = listLongTermSessions(vault, {
    code: activeCode ?? '',
    gameId: state?.gameId ?? '',
    nickname: state?.nickname,
  }).length
  const filteredRooms = rooms.filter((room) => roomMatchesFilter(room, filter))

  const refresh = () => setVaultTick((n) => n + 1)

  const openRoom = (room: LongTermRoom) => {
    setMenuKey(null)
    if (room.ended && room.historyId) {
      navigate(`/history/${room.historyId}`)
      return
    }
    navigate(`/session/${room.code}`)
  }

  const endRoom = async (room: LongTermRoom) => {
    setMenuKey(null)
    if (room.ended) return
    if (room.live) {
      endSession()
    } else {
      const snap = vault.find((v) => v.state.code === room.code && v.state.gameId === room.gameId)
      if (snap) await archiveParkedSession(snap)
      else await clearHostSnapshotAsync({ gameId: room.gameId, code: room.code })
    }
    refresh()
  }

  const deleteRoom = async (room: LongTermRoom) => {
    setMenuKey(null)
    if (room.ended) return
    if (room.live) discardSession()
    else await clearHostSnapshotAsync({ gameId: room.gameId, code: room.code })
    refresh()
  }

  const confirmEnd = (room: LongTermRoom) => {
    if (
      !window.confirm(
        'End this game? Standings are saved to history, the room closes, and guests are disconnected.',
      )
    ) {
      return
    }
    void endRoom(room)
  }

  const confirmDelete = (room: LongTermRoom) => {
    if (
      !window.confirm(
        'Delete this game without saving standings? This cannot be undone.',
      )
    ) {
      return
    }
    void deleteRoom(room)
  }

  const inviteTitle = inviteRoom
    ? sessionDisplayName({
        nickname: inviteRoom.nickname,
        gameId: inviteRoom.gameId,
      })
    : ''

  const empty = openCount === 0 && !showEnded

  return (
    <div className="grid gap-4 pb-20">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Return to a game</h1>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/40 px-3 py-2.5">
        <Label htmlFor="show-ended" className="text-sm font-normal text-muted-foreground">
          Show ended banks
        </Label>
        <Switch id="show-ended" checked={showEnded} onCheckedChange={setShowEnded} />
      </div>

      {empty ? (
        <Card>
          <CardHeader className="items-center pb-5 text-center">
            <MoonIcon className="size-8 text-muted-foreground" />
            <CardTitle>No long-term games</CardTitle>
            <CardDescription>
              Parked banks and other ongoing rooms show up here. Host a Poker Bank to start one.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button asChild>
              <Link to="/host/poker-bank">Host Poker Bank</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">
            Click to open · right-click or ⋯ for End / Delete
          </p>
          {filteredRooms.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {rooms.length === 0
                  ? 'No ended banks in history yet.'
                  : `No games match “${filter.trim()}”.`}
              </CardContent>
            </Card>
          ) : (
            filteredRooms.map((room) => {
              const game = getGameEngine(room.gameId)
              const Icon = getGameIcon(room.gameId)
              const title = sessionDisplayName({
                nickname: room.nickname,
                gameId: room.gameId,
              })
              const menuOpen = menuKey === room.key
              const status = room.live
                ? 'Live now'
                : room.ended
                  ? `Ended · ${formatDate(room.at)}`
                  : `Parked · ${formatDate(room.at)}`
              return (
                <div
                  key={room.key}
                  className="relative"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (!room.ended) setMenuKey(room.key)
                  }}
                >
                  <Card
                    className={
                      room.live
                        ? 'border-primary/40 bg-primary/5'
                        : room.ended
                          ? 'opacity-80'
                          : undefined
                    }
                  >
                    <CardContent className="flex items-center gap-2 p-3.5">
                      <button
                        type="button"
                        onClick={() => openRoom(room)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors"
                      >
                        <Icon className="size-6 shrink-0" style={{ color: game?.accentColor }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{title}</div>
                          <div className="text-xs text-muted-foreground">
                            {room.nickname ? `${game?.name} · ` : null}
                            {status}
                          </div>
                        </div>
                      </button>
                      {!room.ended ? (
                        <button
                          type="button"
                          onClick={() => setInviteRoom(room)}
                          className="shrink-0 rounded-md px-1.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                          aria-label={`Show invite for ${room.code}`}
                        >
                          {room.code}
                        </button>
                      ) : (
                        <span className="shrink-0 px-1.5 font-mono text-xs text-muted-foreground">
                          {room.code}
                        </span>
                      )}
                      {room.live ? (
                        <button
                          type="button"
                          onClick={() => setInviteRoom(room)}
                          className="shrink-0"
                          aria-label={`Show invite for ${title}`}
                        >
                          <Badge variant="default">Live</Badge>
                        </button>
                      ) : null}
                      {room.ended ? <Badge variant="outline">Ended</Badge> : null}
                      {!room.ended ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${title}`}
                          onClick={() => setMenuKey((k) => (k === room.key ? null : room.key))}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                  {menuOpen ? (
                    <>
                      <button
                        type="button"
                        aria-label="Dismiss menu"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setMenuKey(null)}
                      />
                      <div className="absolute right-2 top-12 z-20 min-w-36 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
                        <MenuItem label="Open" onClick={() => openRoom(room)} />
                        <MenuItem label="End" danger onClick={() => confirmEnd(room)} />
                        <MenuItem label="Delete" danger onClick={() => confirmDelete(room)} />
                      </div>
                    </>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      )}

      {!empty || showEnded ? (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto w-full max-w-xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <div className="relative rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by name or code"
                aria-label="Filter games"
                className="h-11 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={inviteRoom != null} onOpenChange={(open) => !open && setInviteRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite · {inviteTitle}</DialogTitle>
          </DialogHeader>
          {inviteRoom ? <QrCard code={inviteRoom.code} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent/40 ${
        danger ? 'text-destructive' : ''
      }`}
    >
      {label}
    </button>
  )
}
