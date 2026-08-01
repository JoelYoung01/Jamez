import { getGameEngine } from '@jamez/core'
import { ArrowLeftIcon, Trash2Icon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { historyStore, useHistory, useStats } from '@/lib/history'
import { useProfile } from '@/lib/profile'
import { formatDate } from '@/lib/utils'

export function HistoryPage() {
  const records = useHistory()
  const stats = useStats()
  const myId = useProfile((s) => s.playerId)

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
            return (
              <Card key={gameId}>
                <CardContent className="flex items-center gap-3 p-3.5">
                  <span className="text-2xl">{game?.emoji ?? '🎲'}</span>
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

      {records.length === 0 ? (
        <Card>
          <CardHeader className="items-center pb-5 text-center">
            <span className="text-3xl">🎲</span>
            <CardTitle>No games yet</CardTitle>
            <CardDescription>
              Finish a session and it lands here — stored on this device only.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-2">
          <h2 className="mt-2 text-sm font-semibold text-muted-foreground">All games</h2>
          {records.map((record) => {
            const game = getGameEngine(record.gameId)
            const won = record.summary.winnerIds.includes(myId)
            return (
              <Card key={record.id}>
                <CardContent className="flex items-center gap-3 p-3.5">
                  <span className="text-2xl">{game?.emoji ?? '🎲'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{record.summary.headline}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatDate(record.finishedAt)} ·{' '}
                      {record.players.map((p) => p.name).join(', ')}
                    </div>
                  </div>
                  {won && <Badge>won</Badge>}
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
          })}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => void historyStore.clear()}
          >
            Clear all history
          </Button>
        </div>
      )}
    </div>
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
