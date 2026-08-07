import { getGameEngine, sessionDisplayName } from '@jamez/core'
import { ArrowLeftIcon, MoreHorizontalIcon, MoonIcon } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGameIcon } from '@/games/registry'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listLongTermSessions, type LongTermRoom } from '@/lib/long-term-sessions'
import {
  clearHostSnapshotAsync,
  listHostSnapshots,
  useSession,
} from '@/lib/session-store'
import { formatDate } from '@/lib/utils'

export function ContinuePage() {
  const navigate = useNavigate()
  const activeCode = useSession((s) => s.code)
  const state = useSession((s) => s.state)
  const endSession = useSession((s) => s.endSession)
  const [vaultTick, setVaultTick] = React.useState(0)
  const vault = React.useMemo(() => listHostSnapshots(), [vaultTick, activeCode, state?.nickname])
  const rooms = listLongTermSessions(vault, {
    code: activeCode ?? '',
    gameId: state?.gameId ?? '',
    nickname: state?.nickname,
  })
  const [menuKey, setMenuKey] = React.useState<string | null>(null)

  const refresh = () => setVaultTick((n) => n + 1)

  const openRoom = (room: LongTermRoom) => {
    setMenuKey(null)
    navigate(`/session/${room.code}`)
  }

  const removeRoom = async (room: LongTermRoom) => {
    setMenuKey(null)
    if (room.live) endSession()
    else await clearHostSnapshotAsync({ gameId: room.gameId, code: room.code })
    refresh()
  }

  const confirmEnd = (room: LongTermRoom) => {
    if (
      !window.confirm(
        'End this game? The room will close and be removed. Connected guests will be disconnected.',
      )
    ) {
      return
    }
    void removeRoom(room)
  }

  const confirmDelete = (room: LongTermRoom) => {
    if (!window.confirm('Delete this game from your list? This cannot be undone.')) return
    void removeRoom(room)
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Return to a game</h1>
      </div>

      {rooms.length === 0 ? (
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
          {rooms.map((room) => {
            const game = getGameEngine(room.gameId)
            const Icon = getGameIcon(room.gameId)
            const title = sessionDisplayName({
              nickname: room.nickname,
              gameId: room.gameId,
            })
            const menuOpen = menuKey === room.key
            return (
              <div
                key={room.key}
                className="relative"
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenuKey(room.key)
                }}
              >
                <Card className={room.live ? 'border-primary/40 bg-primary/5' : undefined}>
                  <CardContent className="flex items-center gap-3 p-3.5">
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
                          {room.live ? 'Live now' : `Parked · ${formatDate(room.at)}`}
                          {' · '}
                          {room.code}
                        </div>
                      </div>
                      <Badge variant={room.live ? 'default' : 'outline'}>
                        {room.live ? 'Return' : 'Open'}
                      </Badge>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${title}`}
                      onClick={() => setMenuKey((k) => (k === room.key ? null : room.key))}
                    >
                      <MoreHorizontalIcon />
                    </Button>
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
          })}
        </div>
      )}
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
