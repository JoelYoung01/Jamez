import { gameEngines, getGameEngine } from '@jamez/core'
import { Link, router, useFocusEffect } from 'expo-router'
import {
  ArrowRightIcon,
  DicesIcon,
  RadioTowerIcon,
  SettingsIcon,
  TicketIcon,
  TrophyIcon,
} from 'lucide-react-native'
import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppButton, Card, Chip, Muted, Screen } from '@/components/ui'
import { getGameIcon } from '@/games/registry'
import { formatDate } from '@/lib/format'
import { useHistory } from '@/lib/history'
import { useProfile } from '@/lib/profile'
import { readHostSnapshot, useSession, type HostSnapshot } from '@/lib/session-store'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const history = useHistory()
  const activeCode = useSession((s) => s.code)
  const { name, emoji } = useProfile()
  const recent = history.slice(0, 3)

  const [snapshot, setSnapshot] = React.useState<HostSnapshot | null>(null)
  useFocusEffect(
    React.useCallback(() => {
      let alive = true
      if (activeCode) {
        setSnapshot(null)
      } else {
        void readHostSnapshot().then((snap) => {
          if (alive) setSnapshot(snap)
        })
      }
      return () => {
        alive = false
      }
    }, [activeCode]),
  )

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }}>
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <DicesIcon size={24} color="#fbbf24" />
            <Text className="text-xl font-extrabold tracking-tight text-zinc-100">Jamez</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Link href="/settings" asChild>
              <Pressable hitSlop={6} className="h-9 w-9 items-center justify-center rounded-lg bg-muted active:opacity-70">
                <SettingsIcon size={18} color="#f4f4f5" />
              </Pressable>
            </Link>
            <Link href="/profile" asChild>
              <Pressable
                hitSlop={6}
                className="h-9 flex-row items-center gap-1.5 rounded-lg bg-muted px-2.5 active:opacity-70"
              >
                <Text className="text-base">{emoji}</Text>
                {name ? (
                  <Text className="max-w-24 text-sm font-medium text-zinc-100" numberOfLines={1}>
                    {name}
                  </Text>
                ) : null}
              </Pressable>
            </Link>
          </View>
        </View>

        <View className="items-center py-5">
          <Text className="text-center text-4xl font-extrabold tracking-tight text-zinc-100">
            Game night, <Text className="text-primary">scored</Text>.
          </Text>
          <Text className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
            Host a session, friends join with a code or QR. Everyone submits their own scores, and
            every stat stays on your devices.
          </Text>
        </View>

        {activeCode && (
          <Card className="mb-3 border-primary/40 bg-primary/10 p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View>
                <Text className="text-sm font-semibold text-zinc-100">Session in progress</Text>
                <Text className="font-mono text-xs tracking-widest text-muted-foreground">{activeCode}</Text>
              </View>
              <AppButton
                size="sm"
                title="Return"
                iconRight={<ArrowRightIcon size={14} color="#251a02" />}
                onPress={() => router.push(`/session/${activeCode}`)}
              />
            </View>
          </Card>
        )}

        {!activeCode && snapshot && snapshot.state.phase !== 'finished' && (
          <Card className="mb-3 border-primary/40 bg-primary/10 p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>
                  Resume hosting {getGameEngine(snapshot.state.gameId)?.name ?? snapshot.state.gameId}
                </Text>
                <Text className="font-mono text-xs tracking-widest text-muted-foreground">
                  {snapshot.state.code}
                </Text>
              </View>
              <AppButton
                size="sm"
                title="Resume"
                iconRight={<ArrowRightIcon size={14} color="#251a02" />}
                onPress={() => router.push(`/session/${snapshot.state.code}`)}
              />
            </View>
          </Card>
        )}

        <View className="gap-3">
          <Pressable onPress={() => router.push('/host')} className="active:opacity-80">
            <Card className="p-5">
              <View className="mb-2 h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                <RadioTowerIcon size={20} color="#fbbf24" />
              </View>
              <Text className="text-lg font-semibold text-zinc-100">Host a game</Text>
              <Muted className="mt-0.5 text-sm">
                Start a session on this phone and invite the table with a QR code.
              </Muted>
              <View className="mt-3 flex-row items-center gap-1">
                <Text className="text-sm font-medium text-primary">Choose a game</Text>
                <ArrowRightIcon size={14} color="#fbbf24" />
              </View>
            </Card>
          </Pressable>

          <Pressable onPress={() => router.push('/join')} className="active:opacity-80">
            <Card className="p-5">
              <View className="mb-2 h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                <TicketIcon size={20} color="#fbbf24" />
              </View>
              <Text className="text-lg font-semibold text-zinc-100">Join a game</Text>
              <Muted className="mt-0.5 text-sm">
                Got a code from the host? Jump in and submit your own scores.
              </Muted>
              <View className="mt-3 flex-row items-center gap-1">
                <Text className="text-sm font-medium text-primary">Enter code or scan</Text>
                <ArrowRightIcon size={14} color="#fbbf24" />
              </View>
            </Card>
          </Pressable>
        </View>

        <View className="flex-row flex-wrap items-center justify-center gap-2 py-4">
          <Muted>On the shelf:</Muted>
          {gameEngines.map((game) => {
            const Icon = getGameIcon(game.id)
            return (
              <Chip key={game.id} icon={<Icon size={12} color={game.accentColor} />}>
                {game.name}
              </Chip>
            )
          })}
          <Chip tone="outline">more coming</Chip>
        </View>

        {recent.length > 0 && (
          <View>
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <TrophyIcon size={14} color="#a1a1ab" />
                <Text className="text-sm font-semibold text-muted-foreground">Recent games</Text>
              </View>
              <Pressable onPress={() => router.push('/history')} hitSlop={6}>
                <Text className="text-xs font-medium text-primary">All history</Text>
              </Pressable>
            </View>
            <View className="gap-2">
              {recent.map((record) => {
                const game = getGameEngine(record.gameId)
                const Icon = getGameIcon(record.gameId)
                return (
                  <Card key={record.id} className="flex-row items-center gap-3 p-3.5">
                    <Icon size={22} color={game?.accentColor ?? '#a1a1ab'} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                        {record.summary.headline}
                      </Text>
                      <Muted>
                        {game?.name} · {formatDate(record.finishedAt)}
                      </Muted>
                    </View>
                  </Card>
                )
              })}
            </View>
          </View>
        )}

        {recent.length === 0 && (
          <Pressable onPress={() => router.push('/history')} className="items-center py-2 active:opacity-70">
            <View className="flex-row items-center gap-1">
              <Text className="text-xs font-medium text-muted-foreground">History & stats</Text>
              <ArrowRightIcon size={12} color="#a1a1ab" />
            </View>
          </Pressable>
        )}
      </View>
    </Screen>
  )
}
