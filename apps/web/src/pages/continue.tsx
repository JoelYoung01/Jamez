import { getGameEngine, sessionDisplayName } from '@jamez/core'
import { ArrowLeftIcon, MoonIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getGameIcon } from '@/games/registry'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listLongTermSessions } from '@/lib/long-term-sessions'
import { listHostSnapshots, useSession } from '@/lib/session-store'
import { formatDate } from '@/lib/utils'

export function ContinuePage() {
  const navigate = useNavigate()
  const activeCode = useSession((s) => s.code)
  const state = useSession((s) => s.state)
  const vault = listHostSnapshots()
  const rooms = listLongTermSessions(vault, {
    code: activeCode ?? '',
    gameId: state?.gameId ?? '',
    nickname: state?.nickname,
  })

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
          {rooms.map((room) => {
            const game = getGameEngine(room.gameId)
            const Icon = getGameIcon(room.gameId)
            const title = sessionDisplayName({
              nickname: room.nickname,
              gameId: room.gameId,
            })
            return (
              <button
                key={room.key}
                type="button"
                onClick={() => navigate(`/session/${room.code}`)}
                className="w-full rounded-xl text-left transition-colors hover:bg-accent/30"
              >
                <Card className={room.live ? 'border-primary/40 bg-primary/5' : undefined}>
                  <CardContent className="flex items-center gap-3 p-3.5">
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
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
