import { gameEngines } from '@jamez/core'
import { router } from 'expo-router'
import { ChevronRightIcon } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { RequireProfile } from '@/components/require-profile'
import { Card, Muted, Screen } from '@/components/ui'
import { getGameIcon } from '@/games/registry'

export default function HostScreen() {
  const insets = useSafeAreaInsets()
  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }}>
        <PageHeader title="Pick a game to host" />
        <RequireProfile>
          <View className="gap-3">
            {gameEngines.map((game) => {
              const Icon = getGameIcon(game.id)
              return (
                <Pressable
                  key={game.id}
                  onPress={() => router.push(`/host/${game.id}`)}
                  className="active:opacity-80"
                >
                  <Card className="flex-row items-center gap-4 p-4">
                    <View
                      className="h-12 w-12 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${game.accentColor}1f` }}
                    >
                      <Icon size={24} color={game.accentColor} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold text-zinc-100">{game.name}</Text>
                      <Muted className="text-sm" >{game.tagline}</Muted>
                      <Muted className="mt-0.5">
                        {game.minPlayers === game.maxPlayers
                          ? `${game.maxPlayers} players`
                          : `${game.minPlayers}–${game.maxPlayers} players`}
                      </Muted>
                    </View>
                    <ChevronRightIcon size={16} color="#a1a1ab" />
                  </Card>
                </Pressable>
              )
            })}
          </View>
        </RequireProfile>
      </View>
    </Screen>
  )
}
