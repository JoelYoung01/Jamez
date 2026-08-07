import {
  buildPokerBalanceReport,
  formatPokerAmount,
  normalizeJoinCode,
  type PokerBankState,
} from '@jamez/core'
import { ArrowLeftIcon, ChartLineIcon } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/lib/session-store'
import { formatDate } from '@/lib/utils'

function formatTickTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function SessionReportsPage() {
  const { code: codeParam = '' } = useParams()
  const code = normalizeJoinCode(codeParam)
  const store = useSession()
  const state = store.state

  if (!code) return <Navigate to="/" replace />

  if (!store.role || store.code !== code || !state) {
    return (
      <div className="grid gap-4">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to={`/session/${code}`}>
            <ArrowLeftIcon />
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
            <CardDescription>Open this bank session first, then come back to reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={`/session/${code}`}>Back to session</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state.gameId !== 'poker-bank' || !state.game) {
    return <Navigate to={`/session/${code}`} replace />
  }

  const game = state.game as PokerBankState
  const report = buildPokerBalanceReport(
    game,
    state.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
  )

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to={`/session/${code}`} aria-label="Back to bank">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Reports</h1>
          <p className="text-xs text-muted-foreground">Balance over time · {code}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ChartLineIcon className="size-4 text-primary" />
            Balance over time
          </CardTitle>
          <CardDescription className="text-xs">
            Rebuilt from the bank ledger. Claims jump to the seat stack; merges add into the
            survivor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No ledger activity yet. Cash in or out to start the chart.
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="oklch(1 0 0 / 8%)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="at"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatTickTime}
                    stroke="oklch(0.68 0.012 275)"
                    tick={{ fill: 'oklch(0.68 0.012 275)', fontSize: 11 }}
                    minTickGap={28}
                  />
                  <YAxis
                    stroke="oklch(0.68 0.012 275)"
                    tick={{ fill: 'oklch(0.68 0.012 275)', fontSize: 11 }}
                    width={56}
                    tickFormatter={(v: number) =>
                      formatPokerAmount(v, {
                        currencyMode: game.config.currencyMode,
                        pointsPerDollar: game.config.pointsPerDollar,
                      }).replace(' pts', '')
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'oklch(0.205 0.012 275)',
                      border: '1px solid oklch(1 0 0 / 12%)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelFormatter={(label) => formatDate(Number(label))}
                    formatter={(value, name) => {
                      const series = report.series.find((s) => s.playerId === name)
                      const n = typeof value === 'number' ? value : Number(value)
                      return [
                        formatPokerAmount(n, game.config),
                        series?.name ?? String(name),
                      ]
                    }}
                  />
                  <Legend
                    formatter={(value) =>
                      report.series.find((s) => s.playerId === value)?.name ?? value
                    }
                  />
                  {report.series.map((s) => (
                    <Line
                      key={s.playerId}
                      type="stepAfter"
                      dataKey={s.playerId}
                      name={s.playerId}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={report.rows.length <= 24}
                      connectNulls
                      isAnimationActive
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {report.series.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current stacks</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {report.series.map((s) => {
              const balance = game.banks[s.playerId]?.balance ?? s.samples.at(-1)?.balance
              if (balance === undefined) return null
              return (
                <div
                  key={s.playerId}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: s.color }}
                    />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="font-mono tabular-nums text-primary">
                    {formatPokerAmount(balance, game.config)}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
