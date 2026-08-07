import {
  buildActivityFeed,
  getGameEngine,
  isOngoingGame,
  sessionDisplayName,
  type ActivityItem,
} from '@jamez/core'
import { Link, router, useFocusEffect } from 'expo-router'
import {
  ArrowRightIcon,
  DicesIcon,
  LayoutGridIcon,
  MoonIcon,
  RadioTowerIcon,
  SettingsIcon,
  TicketIcon,
  TrophyIcon,
} from 'lucide-react-native'
import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card, Chip, Muted, Screen } from '@/components/ui'
import { getGameIcon } from '@/games/registry'
import { formatDate } from '@/lib/format'
import { useHistory } from '@/lib/history'
import { listLongTermSessions } from '@/lib/long-term-sessions'
import { useProfile } from '@/lib/profile'
import { listHostSnapshots, useSession, type HostSnapshot } from '@/lib/session-store'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const history = useHistory()
  const activeCode = useSession((s) => s.code)
  const state = useSession((s) => s.state)
  const { name, emoji } = useProfile()

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

  const recent = buildActivityFeed({ history, vault })
    .filter((item) => item.kind === 'history')
    .slice(0, 5)
  const longTermCount = listLongTermSessions(vault, {
    code: activeCode ?? '',
    gameId: state?.gameId ?? '',
    nickname: state?.nickname,
  }).length

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

        <View className="gap-3">
          <View className="flex-row gap-3">
            <HomeTile
              icon={<RadioTowerIcon size={20} color="#fbbf24" />}
              title="Host"
              description="Start a session and invite the table."
              cta="Choose a game"
              onPress={() => router.push('/host')}
            />
            <HomeTile
              icon={<TicketIcon size={20} color="#fbbf24" />}
              title="Join"
              description="Enter a code or scan a QR."
              cta="Enter code"
              onPress={() => router.push('/join')}
            />
          </View>
          <View className="flex-row gap-3">
            <HomeTile
              icon={<MoonIcon size={20} color="#fbbf24" />}
              title="Return to game"
              description="Parked banks and long-term rooms."
              cta={longTermCount > 0 ? `${longTermCount} open` : 'None parked'}
              badge={longTermCount > 0 ? String(longTermCount) : undefined}
              onPress={() => router.push('/continue')}
            />
            <HomeTile
              icon={<LayoutGridIcon size={20} color="#fbbf24" />}
              title="Browse shelf"
              description="See every game on the shelf."
              cta="Browse games"
              onPress={() => router.push('/host')}
            />
          </View>
        </View>

        {recent.length > 0 && (
          <View className="mt-5">
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
              {recent.map((item) => (
                <ActivityRow key={item.key} item={item} />
              ))}
            </View>
          </View>
        )}

        {recent.length === 0 && (
          <Pressable onPress={() => router.push('/history')} className="items-center py-4 active:opacity-70">
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

function HomeTile({
  icon,
  title,
  description,
  cta,
  badge,
  onPress,
}: {
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  badge?: string
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} className="min-w-0 flex-1 active:opacity-80">
      <Card className="relative h-full p-4">
        {badge ? (
          <View className="absolute right-2.5 top-2.5 rounded-full bg-primary px-2 py-0.5">
            <Text className="text-[10px] font-bold text-primary-foreground">{badge}</Text>
          </View>
        ) : null}
        <View className="mb-2 h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
          {icon}
        </View>
        <Text className="text-base font-semibold leading-tight text-zinc-100">{title}</Text>
        <Muted className="mt-0.5 text-xs leading-snug">{description}</Muted>
        <View className="mt-2 flex-row items-center gap-0.5">
          <Text className="text-xs font-medium text-primary">{cta}</Text>
          <ArrowRightIcon size={12} color="#fbbf24" />
        </View>
      </Card>
    </Pressable>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  if (item.kind !== 'history') return null

  const { record, canOpen } = item
  const game = getGameEngine(record.gameId)
  const Icon = getGameIcon(record.gameId)
  const title = record.nickname
    ? sessionDisplayName({ nickname: record.nickname, gameId: record.gameId })
    : record.summary.headline
  const ongoing = game ? isOngoingGame(game) : false

  return (
    <Pressable
      onPress={() =>
        canOpen ? router.push(`/session/${record.code}`) : router.push(`/history/${record.id}`)
      }
      className="active:opacity-80"
    >
      <Card className="flex-row items-center gap-3 p-3.5">
        <Icon size={22} color={game?.accentColor ?? '#a1a1ab'} />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
            {title}
          </Text>
          <Muted>
            {game?.name} · {formatDate(record.finishedAt)}
          </Muted>
        </View>
        {canOpen ? <Chip tone="outline">{ongoing ? 'Open' : 'Resume'}</Chip> : null}
      </Card>
    </Pressable>
  )
}
