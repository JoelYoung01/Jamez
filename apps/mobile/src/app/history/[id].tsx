import { getGameEngine, sessionDisplayName } from '@jamez/core'
import { router, useLocalSearchParams } from 'expo-router'
import * as React from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, Muted, Screen } from '@/components/ui'
import { getGameIcon } from '@/games/registry'
import { formatDate } from '@/lib/format'
import { useHistory } from '@/lib/history'
import { listHostSnapshots } from '@/lib/session-store'

export default function HistoryDetailScreen() {
  const insets = useSafeAreaInsets()
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const records = useHistory()
  const record = records.find((r) => r.id === id)
  const [canOpen, setCanOpen] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    void listHostSnapshots().then((vault) => {
      if (!alive || !record) return
      setCanOpen(
        vault.some(
          (v) =>
            v.state.sessionId === record.id ||
            (v.state.code === record.code && v.state.gameId === record.gameId),
        ),
      )
    })
    return () => {
      alive = false
    }
  }, [record])

  if (!record) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 8 }} className="gap-3">
          <PageHeader title="Not found" />
          <Muted>That game is no longer in local history.</Muted>
          <AppButton title="Back to history" onPress={() => router.replace('/history')} />
        </View>
      </Screen>
    )
  }

  const game = getGameEngine(record.gameId)
  const Icon = getGameIcon(record.gameId)
  const title = sessionDisplayName({ nickname: record.nickname, gameId: record.gameId })

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-3">
        <PageHeader title={title} />

        <Card className="flex-row items-center gap-3 p-4">
          <Icon size={28} color={game?.accentColor ?? '#a1a1ab'} />
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-zinc-100">{record.summary.headline}</Text>
            <Muted>
              {game?.name} · {formatDate(record.finishedAt)} · {record.code}
            </Muted>
          </View>
        </Card>

        <Card className="gap-2 p-4">
          <Text className="text-sm font-semibold text-zinc-100">Results</Text>
          {record.summary.entries.map((entry) => {
            const player = record.players.find((p) => p.id === entry.playerId)
            const winner = record.summary.winnerIds.includes(entry.playerId)
            return (
              <View
                key={entry.playerId}
                className={`flex-row items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  winner ? 'border-primary/50 bg-primary/10' : 'border-line bg-background/40'
                }`}
              >
                <Text className="w-6 text-center text-xs font-bold text-muted-foreground">
                  #{entry.rank}
                </Text>
                <Text className="text-lg">{player?.emoji}</Text>
                <Text className="min-w-0 flex-1 text-sm font-medium text-zinc-100" numberOfLines={1}>
                  {player?.name ?? 'Player'}
                </Text>
                <Text className="font-mono text-sm text-muted-foreground">{entry.scoreText}</Text>
              </View>
            )
          })}
        </Card>

        {canOpen && (
          <AppButton size="lg" title="Open session" onPress={() => router.push(`/session/${record.code}`)} />
        )}
      </View>
    </Screen>
  )
}
