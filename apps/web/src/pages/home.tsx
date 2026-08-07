import {
  buildActivityFeed,
  gameEngines,
  getGameEngine,
  sessionDisplayName,
  type ActivityItem,
} from '@jamez/core'
import { ArrowRightIcon, RadioTowerIcon, TicketIcon, TrophyIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getGameIcon } from '@/games/registry'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useHistory } from '@/lib/history'
import { listHostSnapshots, useSession } from '@/lib/session-store'
import { formatDate } from '@/lib/utils'

export function HomePage() {
  const history = useHistory()
  const activeCode = useSession((s) => s.code)
  const navigate = useNavigate()
  const vault = listHostSnapshots()
  const recent = buildActivityFeed({ history, vault }).slice(0, 5)

  return (
    <div className="grid gap-4">
      <section className="py-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">Jamez</h1>
      </section>

      {activeCode && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="text-sm font-semibold">Session in progress</div>
              <div className="font-mono text-xs text-muted-foreground">{activeCode}</div>
            </div>
            <Button asChild size="sm">
              <Link to={`/session/${activeCode}`}>
                Return <ArrowRightIcon />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link to="/host" className="group">
          <Card className="h-full transition-all group-hover:border-primary/50 group-hover:bg-primary/5">
            <CardHeader>
              <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <RadioTowerIcon className="size-5" />
              </span>
              <CardTitle className="text-lg">Host a game</CardTitle>
              <CardDescription>
                Start a session on this device and invite the table with a QR code.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 text-sm font-medium text-primary">
              Choose a game <ArrowRightIcon className="ml-1 inline size-3.5" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/join" className="group">
          <Card className="h-full transition-all group-hover:border-primary/50 group-hover:bg-primary/5">
            <CardHeader>
              <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <TicketIcon className="size-5" />
              </span>
              <CardTitle className="text-lg">Join a game</CardTitle>
              <CardDescription>
                Got a code from the host? Jump in and submit your own scores.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 text-sm font-medium text-primary">
              Enter code <ArrowRightIcon className="ml-1 inline size-3.5" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 py-2">
        <span className="text-xs text-muted-foreground">On the shelf:</span>
        {gameEngines.map((game) => {
          const Icon = getGameIcon(game.id)
          return (
            <Badge key={game.id} variant="secondary">
              <Icon className="size-3" style={{ color: game.accentColor }} /> {game.name}
            </Badge>
          )
        })}
        <Badge variant="outline">more coming</Badge>
      </div>

      {recent.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <TrophyIcon className="size-4" /> Recent games
            </h2>
            <Button asChild variant="link" size="sm" className="text-xs">
              <Link to="/history">All history</Link>
            </Button>
          </div>
          <div className="grid gap-2">
            {recent.map((item) => (
              <ActivityRow
                key={item.key}
                item={item}
                onOpen={(code) => navigate(`/session/${code}`)}
                onHistory={(id) => navigate(`/history/${id}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ActivityRow({
  item,
  onOpen,
  onHistory,
}: {
  item: ActivityItem
  onOpen: (code: string) => void
  onHistory: (id: string) => void
}) {
  if (item.kind === 'parked') {
    const game = getGameEngine(item.gameId)
    const Icon = getGameIcon(item.gameId)
    const title = sessionDisplayName({ nickname: item.nickname, gameId: item.gameId })
    return (
      <button
        type="button"
        onClick={() => onOpen(item.code)}
        className="w-full rounded-xl text-left transition-colors hover:bg-accent/30"
      >
        <Card>
          <CardContent className="flex items-center gap-3 p-3.5">
            <Icon className="size-6 shrink-0" style={{ color: game?.accentColor }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{title}</div>
              <div className="text-xs text-muted-foreground">
                {item.nickname ? game?.name : null}
                {item.nickname ? ' · ' : null}
                Parked · {item.code}
              </div>
            </div>
            <Badge variant="outline">Open</Badge>
          </CardContent>
        </Card>
      </button>
    )
  }

  const { record, canOpen } = item
  const game = getGameEngine(record.gameId)
  const Icon = getGameIcon(record.gameId)
  const title = record.nickname
    ? sessionDisplayName({ nickname: record.nickname, gameId: record.gameId })
    : record.summary.headline
  return (
    <button
      type="button"
      onClick={() => (canOpen ? onOpen(record.code) : onHistory(record.id))}
      className="w-full rounded-xl text-left transition-colors hover:bg-accent/30"
    >
      <Card>
        <CardContent className="flex items-center gap-3 p-3.5">
          <Icon className="size-6 shrink-0" style={{ color: game?.accentColor }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="text-xs text-muted-foreground">
              {record.nickname ? `${record.summary.headline} · ` : null}
              {game?.name} · {formatDate(record.finishedAt)}
            </div>
          </div>
          {canOpen ? <Badge variant="outline">Open</Badge> : null}
        </CardContent>
      </Card>
    </button>
  )
}
