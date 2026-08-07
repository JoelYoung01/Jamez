import {
  buildActivityFeed,
  getGameEngine,
  isOngoingGame,
  sessionDisplayName,
  type ActivityItem,
} from '@jamez/core'
import {
  ArrowRightIcon,
  LayoutGridIcon,
  MoonIcon,
  RadioTowerIcon,
  TicketIcon,
  TrophyIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGameIcon } from '@/games/registry'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useHistory } from '@/lib/history'
import { listLongTermSessions } from '@/lib/long-term-sessions'
import { listHostSnapshots, useSession } from '@/lib/session-store'
import { formatDate } from '@/lib/utils'

export function HomePage() {
  const history = useHistory()
  const activeCode = useSession((s) => s.code)
  const state = useSession((s) => s.state)
  const navigate = useNavigate()
  const vault = listHostSnapshots()
  // History list: finished games (parked long-term rooms live under Return to game).
  const recent = buildActivityFeed({ history, vault })
    .filter((item) => item.kind === 'history')
    .slice(0, 5)
  const longTermCount = listLongTermSessions(vault, {
    code: activeCode ?? '',
    gameId: state?.gameId,
    nickname: state?.nickname,
  }).length

  return (
    <div className="grid gap-4">
      <section className="py-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">Jamez</h1>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <HomeTile
          to="/host"
          icon={<RadioTowerIcon className="size-5" />}
          title="Host"
          description="Start a session and invite the table."
          cta="Choose a game"
        />
        <HomeTile
          to="/join"
          icon={<TicketIcon className="size-5" />}
          title="Join"
          description="Enter a code or scan a QR."
          cta="Enter code"
        />
        <HomeTile
          to="/continue"
          icon={<MoonIcon className="size-5" />}
          title="Return to game"
          description="Parked banks and long-term rooms."
          cta={longTermCount > 0 ? `${longTermCount} open` : 'None parked'}
          badge={longTermCount > 0 ? String(longTermCount) : undefined}
        />
        <HomeTile
          to="/host"
          icon={<LayoutGridIcon className="size-5" />}
          title="Browse shelf"
          description="See every game on the shelf."
          cta="Browse games"
        />
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

function HomeTile({
  to,
  icon,
  title,
  description,
  cta,
  badge,
}: {
  to: string
  icon: ReactNode
  title: string
  description: string
  cta: string
  badge?: string
}) {
  return (
    <Link to={to} className="group flex h-full min-w-0">
      <Card className="relative flex h-full w-full flex-col transition-all group-hover:border-primary/50 group-hover:bg-primary/5">
        {badge ? (
          <Badge className="absolute right-2.5 top-2.5 tabular-nums">{badge}</Badge>
        ) : null}
        <CardHeader className="flex-1 p-4 pb-2">
          <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            {icon}
          </span>
          <CardTitle className="text-base leading-tight">{title}</CardTitle>
          <CardDescription className="text-xs leading-snug">{description}</CardDescription>
        </CardHeader>
        <CardContent className="mt-auto p-4 pt-1 text-xs font-medium text-primary">
          {cta} <ArrowRightIcon className="ml-0.5 inline size-3" />
        </CardContent>
      </Card>
    </Link>
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
  if (item.kind !== 'history') return null

  const { record, canOpen } = item
  const game = getGameEngine(record.gameId)
  const Icon = getGameIcon(record.gameId)
  const title = record.nickname
    ? sessionDisplayName({ nickname: record.nickname, gameId: record.gameId })
    : record.summary.headline
  const ongoing = game ? isOngoingGame(game) : false

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
          {canOpen ? (
            <Badge variant="outline">{ongoing ? 'Open' : 'Resume'}</Badge>
          ) : null}
        </CardContent>
      </Card>
    </button>
  )
}
