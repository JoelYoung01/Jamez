import {
  buildPokerBalanceReport,
  formatPokerAmount,
  normalizeJoinCode,
  type PokerBankState,
} from '@jamez/core'
import { router, useLocalSearchParams } from 'expo-router'
import { ChartLineIcon } from 'lucide-react-native'
import * as React from 'react'
import { Dimensions, Text, View } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, CardTitle, Muted, Screen } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { useSession } from '@/lib/session-store'

function formatTickTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function SessionReportsScreen() {
  const insets = useSafeAreaInsets()
  const { code: codeParam = '' } = useLocalSearchParams<{ code: string }>()
  const code = normalizeJoinCode(codeParam)
  const store = useSession()
  const state = store.state

  if (!code) return null

  if (!store.role || store.code !== code || !state) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 8 }} className="gap-3">
          <PageHeader title="Reports" />
          <Card className="gap-2 p-4">
            <CardTitle>Session not open</CardTitle>
            <Muted>Open this bank session first, then come back to reports.</Muted>
            <AppButton title="Back to session" onPress={() => router.replace(`/session/${code}`)} />
          </Card>
        </View>
      </Screen>
    )
  }

  if (state.gameId !== 'poker-bank' || !state.game) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 8 }} className="gap-3">
          <PageHeader title="Reports" />
          <Card className="gap-2 p-4">
            <CardTitle>No poker reports</CardTitle>
            <Muted>Balance charts are only available for Poker Bank sessions.</Muted>
            <AppButton title="Back" onPress={() => router.back()} />
          </Card>
        </View>
      </Screen>
    )
  }

  const game = state.game as PokerBankState
  const report = buildPokerBalanceReport(
    game,
    state.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
  )
  const chartWidth = Math.min(Dimensions.get('window').width - 48, 520)
  const labelEvery = Math.max(1, Math.ceil(report.rows.length / 4))

  const dataSet = report.series.map((series) => {
    const firstAt = series.samples[0]?.at
    const startIndex =
      firstAt === undefined ? 0 : Math.max(0, report.rows.findIndex((row) => row.at >= firstAt))
    const firstBalance = series.samples[0]?.balance ?? 0
    return {
      data: report.rows.map((row, index) => {
        const value =
          typeof row[series.playerId] === 'number' ? (row[series.playerId] as number) : firstBalance
        return {
          value,
          label: index % labelEvery === 0 ? formatTickTime(row.at) : '',
          labelTextStyle: { color: '#71717a', fontSize: 10 },
        }
      }),
      color: series.color,
      startIndex,
      stepChart: true,
      thickness: 2,
      hideDataPoints: report.rows.length > 24,
      dataPointsColor: series.color,
      dataPointsRadius: 3,
    }
  })

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4">
        <PageHeader
          title="Reports"
          icon={<ChartLineIcon size={18} color="#fbbf24" />}
        />
        <Muted>Balance over time · {code}</Muted>

        <Card className="gap-3 p-4">
          <CardTitle>Balance over time</CardTitle>
          <Muted>
            Rebuilt from the bank ledger. Claims jump to the seat stack; merges add into the
            survivor.
          </Muted>
          {report.rows.length === 0 ? (
            <Muted className="py-8 text-center">
              No ledger activity yet. Cash in or out to start the chart.
            </Muted>
          ) : (
            <View className="mt-2 overflow-hidden">
              <LineChart
                dataSet={dataSet}
                height={220}
                width={chartWidth}
                spacing={
                  report.rows.length <= 1
                    ? chartWidth / 2
                    : Math.max(28, (chartWidth - 40) / Math.max(1, report.rows.length - 1))
                }
                initialSpacing={12}
                endSpacing={12}
                noOfSections={4}
                yAxisColor="#3f3f46"
                xAxisColor="#3f3f46"
                rulesColor="#27272a"
                yAxisTextStyle={{ color: '#71717a', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#71717a', fontSize: 10 }}
                formatYLabel={(v) =>
                  formatPokerAmount(Number(v), {
                    currencyMode: game.config.currencyMode,
                    pointsPerDollar: game.config.pointsPerDollar,
                  }).replace(' pts', '')
                }
                yAxisLabelWidth={52}
                backgroundColor="transparent"
                isAnimated
              />
              <View className="mt-3 flex-row flex-wrap gap-x-3 gap-y-1.5">
                {report.series.map((s) => (
                  <View key={s.playerId} className="flex-row items-center gap-1.5">
                    <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <Text className="text-xs text-zinc-300">{s.name}</Text>
                  </View>
                ))}
              </View>
              {report.rows[0] ? (
                <Muted className="mt-2">
                  {formatDate(report.rows[0].at)}
                  {report.rows.length > 1
                    ? ` → ${formatDate(report.rows[report.rows.length - 1]!.at)}`
                    : ''}
                </Muted>
              ) : null}
            </View>
          )}
        </Card>

        {report.series.length > 0 ? (
          <Card className="gap-2 p-4">
            <CardTitle>Current stacks</CardTitle>
            {report.series.map((s) => {
              const balance = game.banks[s.playerId]?.balance ?? s.samples.at(-1)?.balance
              if (balance === undefined) return null
              return (
                <View key={s.playerId} className="flex-row items-center justify-between gap-2">
                  <View className="min-w-0 flex-1 flex-row items-center gap-2">
                    <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <Text className="text-sm text-zinc-100" numberOfLines={1}>
                      {s.name}
                    </Text>
                  </View>
                  <Text className="font-mono text-sm font-semibold text-primary">
                    {formatPokerAmount(balance, game.config)}
                  </Text>
                </View>
              )
            })}
          </Card>
        ) : null}
      </View>
    </Screen>
  )
}
