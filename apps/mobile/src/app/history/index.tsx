import {
  buildActivityFeed,
  getGameEngine,
  isEndedLongTermRecord,
  sessionDisplayName,
  type ActivityItem,
} from '@jamez/core'
import { router, useFocusEffect } from 'expo-router'
import { DicesIcon, Trash2Icon } from 'lucide-react-native'
import * as React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FloatingSearch } from '@/components/floating-search'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, CardTitle, Chip, Muted } from '@/components/ui'
import { getGameIcon } from '@/games/registry'
import { formatDate } from '@/lib/format'
import { historyStore, useHistory, useStats } from '@/lib/history'
import { useProfile } from '@/lib/profile'
import { listHostSnapshots, type HostSnapshot } from '@/lib/session-store'

function activityMatchesFilter(item: ActivityItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (item.kind === 'parked') {
    const game = getGameEngine(item.gameId)
    const title = sessionDisplayName({ nickname: item.nickname, gameId: item.gameId })
    return (
      title.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (game?.name.toLowerCase().includes(q) ?? false) ||
      (item.nickname?.toLowerCase().includes(q) ?? false) ||
      item.players.some((p) => p.name.toLowerCase().includes(q))
    )
  }
  const { record } = item
  const game = getGameEngine(record.gameId)
  const title = record.nickname
    ? sessionDisplayName({ nickname: record.nickname, gameId: record.gameId })
    : record.summary.headline
  return (
    title.toLowerCase().includes(q) ||
    record.summary.headline.toLowerCase().includes(q) ||
    record.code.toLowerCase().includes(q) ||
    (game?.name.toLowerCase().includes(q) ?? false) ||
    (record.nickname?.toLowerCase().includes(q) ?? false) ||
    record.players.some((p) => p.name.toLowerCase().includes(q))
  )
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const records = useHistory()
  const stats = useStats()
  const myId = useProfile((s) => s.playerId)
  const [vault, setVault] = React.useState<HostSnapshot[]>([])
  const [filter, setFilter] = React.useState('')
  const [listBottomPad, setListBottomPad] = React.useState(84)

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

  const feed = buildActivityFeed({
    history: records,
    vault,
  })
  const filteredFeed = feed.filter((item) => activityMatchesFilter(item, filter))

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: feed.length > 0 ? listBottomPad : Math.max(insets.bottom, 24),
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View className="w-full max-w-xl gap-3 self-center">
          <PageHeader title="History & stats" />

          <View className="flex-row gap-2">
            <StatTile label="Games" value={stats.gamesPlayed} />
            <StatTile label="Wins" value={stats.wins} />
            <StatTile
              label="Win rate"
              value={
                stats.gamesPlayed > 0
                  ? `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%`
                  : '—'
              }
            />
          </View>

          {Object.keys(stats.byGame).length > 0 && (
            <View className="gap-2">
              {Object.entries(stats.byGame).map(([gameId, gameStats]) => {
                const game = getGameEngine(gameId)
                const Icon = getGameIcon(gameId)
                return (
                  <Card key={gameId} className="flex-row items-center gap-3 p-3.5">
                    <Icon size={22} color={game?.accentColor ?? '#a1a1ab'} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-medium text-zinc-100">
                        {game?.name ?? gameId}
                      </Text>
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
            <Card className="items-center gap-1.5 px-6 py-10">
              <DicesIcon size={32} color="#a1a1ab" />
              <CardTitle>No games yet</CardTitle>
              <Muted className="text-center">
                Finish a session and it lands here. Open (draft / parked) rooms show up too. Stored on
                this phone only.
              </Muted>
            </Card>
          ) : (
            <View className="gap-2">
              <Text className="text-sm font-semibold text-muted-foreground">All games</Text>
              {filteredFeed.length === 0 ? (
                <Card className="items-center px-6 py-8">
                  <Muted className="text-center">No games match “{filter.trim()}”.</Muted>
                </Card>
              ) : (
                filteredFeed.map((item) => (
                  <HistoryActivityRow key={item.key} item={item} myId={myId} />
                ))
              )}
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
      </ScrollView>

      <FloatingSearch
        value={filter}
        onChange={setFilter}
        placeholder="Filter games"
        searchLabel="Search history"
        visible={feed.length > 0}
        onBottomPadChange={setListBottomPad}
      />
    </View>
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
              {item.statusLabel} · {item.players.map((p) => p.name).join(', ')}
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
  const endedBank = isEndedLongTermRecord(record)
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
            {endedBank ? 'Ended · ' : ''}
            {formatDate(record.finishedAt)} · {record.players.map((p) => p.name).join(', ')}
          </Muted>
        </View>
        {endedBank ? <Chip tone="outline">Ended</Chip> : null}
        {won && !endedBank ? <Chip tone="primary">won</Chip> : null}
        {canOpen ? <Chip tone="outline">Open</Chip> : null}
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
