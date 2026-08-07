import { getGameEngine, sessionDisplayName } from '@jamez/core'
import { router, useFocusEffect } from 'expo-router'
import { MoonIcon, SearchIcon } from 'lucide-react-native'
import * as React from 'react'
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppTextInput } from '@/components/app-text-input'
import { PageHeader } from '@/components/page-header'
import { QrCard } from '@/components/qr-card'
import { AppButton, Card, CardTitle, Chip, Muted } from '@/components/ui'
import { getGameIcon } from '@/games/registry'
import { formatDate } from '@/lib/format'
import { useHistory } from '@/lib/history'
import { useKeyboardHeight } from '@/lib/keyboard'
import { listLongTermSessions, type LongTermRoom } from '@/lib/long-term-sessions'
import {
  archiveParkedSession,
  clearHostSnapshotAsync,
  listHostSnapshots,
  useSession,
  type HostSnapshot,
} from '@/lib/session-store'

function roomMatchesFilter(room: LongTermRoom, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const game = getGameEngine(room.gameId)
  const title = sessionDisplayName({
    nickname: room.nickname,
    gameId: room.gameId,
  })
  return (
    title.toLowerCase().includes(q) ||
    room.code.toLowerCase().includes(q) ||
    (game?.name.toLowerCase().includes(q) ?? false) ||
    (room.nickname?.toLowerCase().includes(q) ?? false)
  )
}

export default function ContinueScreen() {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()
  const history = useHistory()
  const activeCode = useSession((s) => s.code)
  const state = useSession((s) => s.state)
  const endSession = useSession((s) => s.endSession)
  const discardSession = useSession((s) => s.discardSession)
  const [vault, setVault] = React.useState<HostSnapshot[]>([])
  const [filter, setFilter] = React.useState('')
  const [showEnded, setShowEnded] = React.useState(false)
  const [inviteRoom, setInviteRoom] = React.useState<LongTermRoom | null>(null)

  const refreshVault = React.useCallback(() => {
    let alive = true
    void listHostSnapshots().then((snaps) => {
      if (alive) setVault(snaps)
    })
    return () => {
      alive = false
    }
  }, [])

  useFocusEffect(
    React.useCallback(() => {
      return refreshVault()
    }, [refreshVault]),
  )

  const rooms = listLongTermSessions(
    vault,
    {
      code: activeCode ?? '',
      gameId: state?.gameId ?? '',
      nickname: state?.nickname,
    },
    { includeEnded: showEnded, history },
  )
  const openCount = listLongTermSessions(vault, {
    code: activeCode ?? '',
    gameId: state?.gameId ?? '',
    nickname: state?.nickname,
  }).length
  const filteredRooms = rooms.filter((room) => roomMatchesFilter(room, filter))
  const empty = openCount === 0 && !showEnded

  const openRoom = (room: LongTermRoom) => {
    if (room.ended && room.historyId) {
      router.push(`/history/${room.historyId}`)
      return
    }
    router.push(`/session/${room.code}`)
  }

  const endRoom = async (room: LongTermRoom) => {
    if (room.ended) return
    if (room.live) {
      endSession()
    } else {
      const snap = vault.find((v) => v.state.code === room.code && v.state.gameId === room.gameId)
      if (snap) await archiveParkedSession(snap)
      else await clearHostSnapshotAsync({ gameId: room.gameId, code: room.code })
    }
    refreshVault()
  }

  const deleteRoom = async (room: LongTermRoom) => {
    if (room.ended) return
    if (room.live) discardSession()
    else await clearHostSnapshotAsync({ gameId: room.gameId, code: room.code })
    refreshVault()
  }

  const confirmEnd = (room: LongTermRoom) => {
    Alert.alert(
      'End this game?',
      'Standings are saved to history, the room closes, and guests are disconnected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: () => {
            void endRoom(room)
          },
        },
      ],
    )
  }

  const confirmDelete = (room: LongTermRoom) => {
    Alert.alert(
      'Delete this game?',
      'Remove it without saving standings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteRoom(room)
          },
        },
      ],
    )
  }

  const showRoomActions = (room: LongTermRoom) => {
    if (room.ended) return
    const title = sessionDisplayName({
      nickname: room.nickname,
      gameId: room.gameId,
    })
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: ['Open', 'End', 'Delete', 'Cancel'],
          destructiveButtonIndex: [1, 2],
          cancelButtonIndex: 3,
        },
        (index) => {
          if (index === 0) openRoom(room)
          else if (index === 1) confirmEnd(room)
          else if (index === 2) confirmDelete(room)
        },
      )
      return
    }
    Alert.alert(title, undefined, [
      { text: 'Open', onPress: () => openRoom(room) },
      { text: 'End', style: 'destructive', onPress: () => confirmEnd(room) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(room) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const filterBarHeight = 56
  const keyboardOpen = keyboardHeight > 0
  const filterOffset = Platform.OS === 'ios' && keyboardOpen ? keyboardHeight : 0
  const listBottomPad =
    (!empty || showEnded ? filterBarHeight + 20 : 32) +
    (Platform.OS === 'ios' && keyboardOpen ? keyboardHeight : Math.max(insets.bottom, 8))

  const inviteTitle = inviteRoom
    ? sessionDisplayName({
        nickname: inviteRoom.nickname,
        gameId: inviteRoom.gameId,
      })
    : ''

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: listBottomPad,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View className="w-full max-w-xl gap-3 self-center">
          <PageHeader title="Return to a game" />

          <Card className="flex-row items-center justify-between px-3.5 py-3">
            <Muted className="flex-1 pr-3">Show ended banks</Muted>
            <Switch
              value={showEnded}
              onValueChange={setShowEnded}
              trackColor={{ false: '#232329', true: '#fbbf24' }}
              thumbColor="#ffffff"
            />
          </Card>

          {empty ? (
            <Card className="items-center gap-2 px-6 py-10">
              <MoonIcon size={32} color="#a1a1ab" />
              <CardTitle>No long-term games</CardTitle>
              <Muted className="text-center">
                Parked banks and other ongoing rooms show up here. Host a Poker Bank to start one.
              </Muted>
              <AppButton
                className="mt-2"
                title="Host Poker Bank"
                onPress={() => router.push('/host/poker-bank')}
              />
            </Card>
          ) : (
            <View className="gap-2">
              <Muted>Tap to open · long-press for End or Delete</Muted>
              {filteredRooms.length === 0 ? (
                <Card className="items-center px-6 py-8">
                  <Muted className="text-center">
                    {rooms.length === 0
                      ? 'No ended banks in history yet.'
                      : `No games match “${filter.trim()}”.`}
                  </Muted>
                </Card>
              ) : (
                filteredRooms.map((room) => {
                  const game = getGameEngine(room.gameId)
                  const Icon = getGameIcon(room.gameId)
                  const title = sessionDisplayName({
                    nickname: room.nickname,
                    gameId: room.gameId,
                  })
                  const status = room.live
                    ? 'Live now'
                    : room.ended
                      ? `Ended · ${formatDate(room.at)}`
                      : `Parked · ${formatDate(room.at)}`
                  return (
                    <Card
                      key={room.key}
                      className={`flex-row items-center gap-2 p-3.5 ${
                        room.live
                          ? 'border-primary/40 bg-primary/10'
                          : room.ended
                            ? 'opacity-80'
                            : ''
                      }`}
                    >
                      <Pressable
                        onPress={() => openRoom(room)}
                        onLongPress={() => showRoomActions(room)}
                        delayLongPress={350}
                        className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
                      >
                        <Icon size={22} color={game?.accentColor ?? '#a1a1ab'} />
                        <View className="min-w-0 flex-1">
                          <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                            {title}
                          </Text>
                          <Muted>
                            {room.nickname ? `${game?.name} · ` : ''}
                            {status}
                          </Muted>
                        </View>
                      </Pressable>
                      {!room.ended ? (
                        <Pressable
                          onPress={() => setInviteRoom(room)}
                          hitSlop={6}
                          className="rounded-md px-1.5 py-1 active:opacity-70"
                          accessibilityRole="button"
                          accessibilityLabel={`Show invite for ${room.code}`}
                        >
                          <Text className="font-mono text-xs text-muted-foreground">
                            {room.code}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text className="px-1.5 font-mono text-xs text-muted-foreground">
                          {room.code}
                        </Text>
                      )}
                      {room.live ? (
                        <Pressable
                          onPress={() => setInviteRoom(room)}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityLabel={`Show invite for ${title}`}
                        >
                          <Chip tone="primary">Live</Chip>
                        </Pressable>
                      ) : null}
                      {room.ended ? <Chip tone="outline">Ended</Chip> : null}
                    </Card>
                  )
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {!empty || showEnded ? (
        <View
          className="absolute inset-x-0 border-t border-line bg-background/95 px-4 pt-2"
          style={{
            bottom: filterOffset,
            paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 8),
          }}
        >
          <View className="flex-row items-center gap-2 rounded-xl border border-line bg-card px-3">
            <SearchIcon size={16} color="#a1a1ab" />
            <AppTextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Filter by name or code"
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
              className="h-11 flex-1 text-base text-zinc-100"
            />
          </View>
        </View>
      ) : null}

      <Modal
        visible={inviteRoom != null}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteRoom(null)}
      >
        <Pressable
          className="flex-1 justify-center bg-black/70 px-5"
          onPress={() => setInviteRoom(null)}
        >
          <Pressable onPress={() => {}} className="rounded-2xl border border-line bg-card p-5">
            <Text className="mb-4 text-lg font-semibold text-zinc-100">
              Invite · {inviteTitle}
            </Text>
            {inviteRoom ? <QrCard code={inviteRoom.code} /> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
