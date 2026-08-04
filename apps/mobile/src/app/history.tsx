import { getGameEngine } from '@jamez/core'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, CardTitle, Chip, Muted, Screen } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { historyStore, useHistory, useStats } from '@/lib/history'
import { useProfile } from '@/lib/profile'

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const records = useHistory()
  const stats = useStats()
  const myId = useProfile((s) => s.playerId)

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }}>
        <PageHeader title="History & stats" />

        <View className="flex-row gap-2">
          <StatTile label="Games" value={stats.gamesPlayed} />
          <StatTile label="Wins" value={stats.wins} />
          <StatTile
            label="Win rate"
            value={stats.gamesPlayed > 0 ? `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%` : '—'}
          />
        </View>

        {Object.keys(stats.byGame).length > 0 && (
          <View className="mt-3 gap-2">
            {Object.entries(stats.byGame).map(([gameId, gameStats]) => {
              const game = getGameEngine(gameId)
              return (
                <Card key={gameId} className="flex-row items-center gap-3 p-3.5">
                  <Text className="text-2xl">{game?.emoji ?? '🎲'}</Text>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-medium text-zinc-100">{game?.name ?? gameId}</Text>
                    <Muted>
                      {gameStats.played} played · {gameStats.wins} won
                    </Muted>
                  </View>
                  {gameStats.bestScore !== null && <Chip>best {gameStats.bestScore}</Chip>}
                </Card>
              )
            })}
          </View>
        )}

        {records.length === 0 ? (
          <Card className="mt-3 items-center gap-1.5 px-6 py-10">
            <Text className="text-3xl">🎲</Text>
            <CardTitle>No games yet</CardTitle>
            <Muted className="text-center">
              Finish a session and it lands here. Stored on this phone only.
            </Muted>
          </Card>
        ) : (
          <View className="mt-4 gap-2">
            <Text className="text-sm font-semibold text-muted-foreground">All games</Text>
            {records.map((record) => {
              const game = getGameEngine(record.gameId)
              const won = record.summary.winnerIds.includes(myId)
              return (
                <Card key={record.id} className="flex-row items-center gap-3 p-3.5">
                  <Text className="text-2xl">{game?.emoji ?? '🎲'}</Text>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                      {record.summary.headline}
                    </Text>
                    <Muted className="mt-0.5" >
                      {formatDate(record.finishedAt)} · {record.players.map((p) => p.name).join(', ')}
                    </Muted>
                  </View>
                  {won && <Chip tone="primary">won</Chip>}
                  <Pressable
                    onPress={() => void historyStore.remove(record.id)}
                    hitSlop={8}
                    className="h-7 w-7 items-center justify-center rounded-md active:opacity-70"
                  >
                    <Text className="text-xs text-muted-foreground">🗑️</Text>
                  </Pressable>
                </Card>
              )
            })}
            <AppButton
              variant="ghost"
              size="sm"
              title="Clear all history"
              onPress={() => void historyStore.clear()}
            />
          </View>
        )}
      </View>
    </Screen>
  )
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="flex-1 items-center gap-0.5 p-3">
      <Text className="font-mono text-2xl font-bold text-zinc-100">{value}</Text>
      <Muted>{label}</Muted>
    </Card>
  )
}
