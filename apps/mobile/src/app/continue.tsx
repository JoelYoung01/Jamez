import { getGameEngine, sessionDisplayName } from '@jamez/core'
import { router, useFocusEffect } from 'expo-router'
import { MoonIcon } from 'lucide-react-native'
import * as React from 'react'
import { ActionSheetIOS, Alert, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, CardTitle, Chip, Muted, Screen } from '@/components/ui'
import { getGameIcon } from '@/games/registry'
import { formatDate } from '@/lib/format'
import { listLongTermSessions, type LongTermRoom } from '@/lib/long-term-sessions'
import {
  clearHostSnapshotAsync,
  listHostSnapshots,
  useSession,
  type HostSnapshot,
} from '@/lib/session-store'

export default function ContinueScreen() {
  const insets = useSafeAreaInsets()
  const activeCode = useSession((s) => s.code)
  const state = useSession((s) => s.state)
  const endSession = useSession((s) => s.endSession)
  const [vault, setVault] = React.useState<HostSnapshot[]>([])

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

  const rooms = listLongTermSessions(vault, {
    code: activeCode ?? '',
    gameId: state?.gameId ?? '',
    nickname: state?.nickname,
  })

  const openRoom = (room: LongTermRoom) => {
    router.push(`/session/${room.code}`)
  }

  const removeRoom = async (room: LongTermRoom) => {
    if (room.live) {
      endSession()
    } else {
      await clearHostSnapshotAsync({ gameId: room.gameId, code: room.code })
    }
    refreshVault()
  }

  const confirmEnd = (room: LongTermRoom) => {
    Alert.alert(
      'End this game?',
      'The room will close and be removed. Connected guests will be disconnected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: () => {
            void removeRoom(room)
          },
        },
      ],
    )
  }

  const confirmDelete = (room: LongTermRoom) => {
    Alert.alert(
      'Delete this game?',
      'Remove it from your list. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void removeRoom(room)
          },
        },
      ],
    )
  }

  const showRoomActions = (room: LongTermRoom) => {
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

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-3">
        <PageHeader title="Return to a game" />

        {rooms.length === 0 ? (
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
            {rooms.map((room) => {
              const game = getGameEngine(room.gameId)
              const Icon = getGameIcon(room.gameId)
              const title = sessionDisplayName({
                nickname: room.nickname,
                gameId: room.gameId,
              })
              return (
                <Pressable
                  key={room.key}
                  onPress={() => openRoom(room)}
                  onLongPress={() => showRoomActions(room)}
                  delayLongPress={350}
                  className="active:opacity-80"
                >
                  <Card
                    className={`flex-row items-center gap-3 p-3.5 ${
                      room.live ? 'border-primary/40 bg-primary/10' : ''
                    }`}
                  >
                    <Icon size={22} color={game?.accentColor ?? '#a1a1ab'} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                        {title}
                      </Text>
                      <Muted>
                        {room.nickname ? `${game?.name} · ` : ''}
                        {room.live ? 'Live now' : `Parked · ${formatDate(room.at)}`}
                        {' · '}
                        {room.code}
                      </Muted>
                    </View>
                    <Chip tone={room.live ? 'primary' : 'outline'}>
                      {room.live ? 'Return' : 'Open'}
                    </Chip>
                  </Card>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
    </Screen>
  )
}
