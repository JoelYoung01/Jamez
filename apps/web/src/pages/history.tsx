import {
  buildActivityFeed,
  getGameEngine,
  isEndedLongTermRecord,
  sessionDisplayName,
  type ActivityItem,
  type HistoryRecord,
} from '@jamez/core'
import { ArrowLeftIcon, DicesIcon, Trash2Icon } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getGameIcon } from '@/games/registry'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { historyStore, useHistory, useStats } from '@/lib/history'
import { useProfile } from '@/lib/profile'
import { listHostSnapshots } from '@/lib/session-store'
import { formatDate } from '@/lib/utils'

export function HistoryPage() {
  const records = useHistory()
  const stats = useStats()
  const myId = useProfile((s) => s.playerId)
  const navigate = useNavigate()
  const vault = listHostSnapshots()
  const [showEnded, setShowEnded] = React.useState(true)
  const feed = buildActivityFeed({
    history: records,
    vault,
    includeEndedLongTerm: showEnded,
  })

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">History & stats</h1>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/40 px-3 py-2.5">
        <Label htmlFor="show-ended-history" className="text-sm font-normal text-muted-foreground">
          Show ended banks
        </Label>
        <Switch id="show-ended-history" checked={showEnded} onCheckedChange={setShowEnded} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Games" value={stats.gamesPlayed} />
        <StatTile label="Wins" value={stats.wins} />
        <StatTile
          label="Win rate"
          value={stats.gamesPlayed > 0 ? `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%` : '—'}
        />
      </div>

      {Object.keys(stats.byGame).length > 0 && (
        <div className="grid gap-2">
          {Object.entries(stats.byGame).map(([gameId, gameStats]) => {
            const game = getGameEngine(gameId)
            const Icon = getGameIcon(gameId)
            return (
              <Card key={gameId}>
                <CardContent className="flex items-center gap-3 p-3.5">
                  <Icon
                    className="size-6 shrink-0 text-muted-foreground"
                    style={{ color: game?.accentColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{game?.name ?? gameId}</div>
                    <div className="text-xs text-muted-foreground">
                      {gameStats.played} played · {gameStats.wins} won
                    </div>
                  </div>
                  {gameStats.bestScore !== null && (
                    <Badge variant="secondary" className="font-mono tabular-nums">
                      best {gameStats.bestScore}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {feed.length === 0 ? (
        <Card>
          <CardHeader className="items-center pb-5 text-center">
            <DicesIcon className="size-8 text-muted-foreground" />
            <CardTitle>No games yet</CardTitle>
            <CardDescription>
              Finish a session and it lands here. Parked and ended banks show up too. Stored on
              this device only.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-2">
          <h2 className="mt-2 text-sm font-semibold text-muted-foreground">All games</h2>
          {feed.map((item) => (
            <HistoryActivityRow
              key={item.key}
              item={item}
              myId={myId}
              onOpen={(code) => navigate(`/session/${code}`)}
              onHistory={(id) => navigate(`/history/${id}`)}
            />
          ))}
          {records.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => void historyStore.clear()}
            >
              Clear finished history
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function HistoryDetailPage() {
  const { id = '' } = useParams()
  const records = useHistory()
  const record = records.find((r) => r.id === id)
  const vault = listHostSnapshots()
  const snap = vault.find(
    (v) => v.state.sessionId === id || (record && v.state.code === record.code && v.state.gameId === record.gameId),
  )
  const navigate = useNavigate()

  if (!record) {
    return (
      <div className="grid gap-4">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link to="/history">
            <ArrowLeftIcon /> Back
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Not found</CardTitle>
            <CardDescription>That game is no longer in local history.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return <HistoryDetail record={record} canOpen={Boolean(snap)} onOpen={() => navigate(`/session/${record.code}`)} />
}

function HistoryDetail({
  record,
  canOpen,
  onOpen,
}: {
  record: HistoryRecord
  canOpen: boolean
  onOpen: () => void
}) {
  const game = getGameEngine(record.gameId)
  const Icon = getGameIcon(record.gameId)
  const title = sessionDisplayName({
    nickname: record.nickname,
    gameId: record.gameId,
  })

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/history">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h1 className="min-w-0 truncate text-lg font-semibold">{title}</h1>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="size-8 shrink-0" style={{ color: game?.accentColor }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{record.summary.headline}</div>
            <div className="text-xs text-muted-foreground">
              {game?.name} · {formatDate(record.finishedAt)} · {record.code}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Results</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {record.summary.entries.map((entry) => {
            const player = record.players.find((p) => p.id === entry.playerId)
            const winner = record.summary.winnerIds.includes(entry.playerId)
            return (
              <div
                key={entry.playerId}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  winner ? 'border-primary/50 bg-primary/10' : 'border-border/50 bg-background/40'
                }`}
              >
                <span className="w-6 text-center text-xs font-bold text-muted-foreground">
                  #{entry.rank}
                </span>
                {player?.photo ? (
                  <img
                    src={player.photo}
                    alt=""
                    className="size-7 rounded-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <span className="text-lg">{player?.emoji}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {player?.name ?? 'Player'}
                </span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {entry.scoreText}
                </span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {canOpen && (
        <Button size="lg" onClick={onOpen}>
          Open session
        </Button>
      )}
    </div>
  )
}

function HistoryActivityRow({
  item,
  myId,
  onOpen,
  onHistory,
}: {
  item: ActivityItem
  myId: string
  onOpen: (code: string) => void
  onHistory: (id: string) => void
}) {
  if (item.kind === 'parked') {
    const game = getGameEngine(item.gameId)
    const Icon = getGameIcon(item.gameId)
    const title = sessionDisplayName({ nickname: item.nickname, gameId: item.gameId })
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-3.5">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => onOpen(item.code)}
          >
            <Icon className="size-6 shrink-0" style={{ color: game?.accentColor }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{title}</div>
              <div className="truncate text-xs text-muted-foreground">
                Parked · {item.players.map((p) => p.name).join(', ')}
              </div>
            </div>
            <Badge variant="outline">Open</Badge>
          </button>
        </CardContent>
      </Card>
    )
  }

  const { record, canOpen } = item
  const game = getGameEngine(record.gameId)
  const Icon = getGameIcon(record.gameId)
  const won = record.summary.winnerIds.includes(myId)
  const endedBank = isEndedLongTermRecord(record)
  const title = record.nickname
    ? sessionDisplayName({ nickname: record.nickname, gameId: record.gameId })
    : record.summary.headline

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => (canOpen ? onOpen(record.code) : onHistory(record.id))}
        >
          <Icon className="size-6 shrink-0" style={{ color: game?.accentColor }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {endedBank ? 'Ended · ' : null}
              {formatDate(record.finishedAt)} · {record.players.map((p) => p.name).join(', ')}
            </div>
          </div>
          {endedBank && <Badge variant="outline">Ended</Badge>}
          {won && !endedBank && <Badge>won</Badge>}
          {canOpen && <Badge variant="outline">Open</Badge>}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete record"
          onClick={() => void historyStore.remove(record.id)}
        >
          <Trash2Icon className="size-3.5 text-muted-foreground" />
        </Button>
      </CardContent>
    </Card>
  )
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-0.5 p-3">
        <span className="font-mono text-2xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  )
}
