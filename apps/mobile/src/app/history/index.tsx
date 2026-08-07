import {
  buildActivityFeed,
  getGameEngine,
  sessionDisplayName,
  type ActivityItem,
} from '@jamez/core'
import { router, useFocusEffect } from 'expo-router'
import { DicesIcon, Trash2Icon } from 'lucide-react-native'
import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, CardTitle, Chip, Muted, Screen } from '@/components/ui'
import { getGameIcon } from '@/games/registry'
import { formatDate } from '@/lib/format'
import { historyStore, useHistory, useStats } from '@/lib/history'
import { useProfile } from '@/lib/profile'
import { listHostSnapshots, type HostSnapshot } from '@/lib/session-store'

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const records = useHistory()
  const stats = useStats()
  const myId = useProfile((s) => s.playerId)
  const [vault, setVault] = React.useState<HostSnapshot[]>([])

  useFocusEffect(
    React.useCallback(() => {
      let alive = true
      void listHostSnapshots().then((snaps) => {
        if (alive) setVault(snaps)
      })
      return () => {
        alive = false
      }
    }, []),
  )

  const feed = buildActivityFeed({ history: records, vault })

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
              const Icon = getGameIcon(gameId)
              return (
                <Card key={gameId} className="flex-row items-center gap-3 p-3.5">
                  <Icon size={22} color={game?.accentColor ?? '#a1a1ab'} />
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

        {feed.length === 0 ? (
          <Card className="mt-3 items-center gap-1.5 px-6 py-10">
            <DicesIcon size={32} color="#a1a1ab" />
            <CardTitle>No games yet</CardTitle>
            <Muted className="text-center">
              Finish a session and it lands here. Parked banks show up too. Stored on this phone
              only.
            </Muted>
          </Card>
        ) : (
          <View className="mt-4 gap-2">
            <Text className="text-sm font-semibold text-muted-foreground">All games</Text>
            {feed.map((item) => (
              <HistoryActivityRow key={item.key} item={item} myId={myId} />
            ))}
            {records.length > 0 && (
              <AppButton
                variant="ghost"
                size="sm"
                title="Clear finished history"
                onPress={() => void historyStore.clear()}
              />
            )}
          </View>
        )}
      </View>
    </Screen>
  )
}

function HistoryActivityRow({ item, myId }: { item: ActivityItem; myId: string }) {
  if (item.kind === 'parked') {
    const game = getGameEngine(item.gameId)
    const Icon = getGameIcon(item.gameId)
    const title = sessionDisplayName({ nickname: item.nickname, gameId: item.gameId })
    return (
      <Pressable onPress={() => router.push(`/session/${item.code}`)} className="active:opacity-80">
        <Card className="flex-row items-center gap-3 p-3.5">
          <Icon size={22} color={game?.accentColor ?? '#a1a1ab'} />
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
              {title}
            </Text>
            <Muted>
              Parked · {item.players.map((p) => p.name).join(', ')}
            </Muted>
          </View>
          <Chip tone="outline">Open</Chip>
        </Card>
      </Pressable>
    )
  }

  const { record, canOpen } = item
  const game = getGameEngine(record.gameId)
  const Icon = getGameIcon(record.gameId)
  const won = record.summary.winnerIds.includes(myId)
  const title = record.nickname
    ? sessionDisplayName({ nickname: record.nickname, gameId: record.gameId })
    : record.summary.headline

  return (
    <Card className="flex-row items-center gap-3 p-3.5">
      <Pressable
        className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
        onPress={() =>
          canOpen ? router.push(`/session/${record.code}`) : router.push(`/history/${record.id}`)
        }
      >
        <Icon size={22} color={game?.accentColor ?? '#a1a1ab'} />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
            {title}
          </Text>
          <Muted className="mt-0.5">
            {formatDate(record.finishedAt)} · {record.players.map((p) => p.name).join(', ')}
          </Muted>
        </View>
        {won && <Chip tone="primary">won</Chip>}
        {canOpen && <Chip tone="outline">Open</Chip>}
      </Pressable>
      <Pressable
        onPress={() => void historyStore.remove(record.id)}
        hitSlop={8}
        className="h-7 w-7 items-center justify-center rounded-md active:opacity-70"
      >
        <Trash2Icon size={14} color="#a1a1ab" />
      </Pressable>
    </Card>
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
