import { getGameEngine, sessionDisplayName } from '@jamez/core'
import { router, useFocusEffect } from 'expo-router'
import { MoonIcon } from 'lucide-react-native'
import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, CardTitle, Chip, Muted, Screen } from '@/components/ui'
import { getGameIcon } from '@/games/registry'
import { formatDate } from '@/lib/format'
import { listLongTermSessions } from '@/lib/long-term-sessions'
import { listHostSnapshots, useSession, type HostSnapshot } from '@/lib/session-store'

export default function ContinueScreen() {
  const insets = useSafeAreaInsets()
  const activeCode = useSession((s) => s.code)
  const state = useSession((s) => s.state)
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

  const rooms = listLongTermSessions(vault, {
    code: activeCode ?? '',
    gameId: state?.gameId ?? '',
    nickname: state?.nickname,
  })

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
                  onPress={() => router.push(`/session/${room.code}`)}
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
