import { gameEngines } from '@jamez/core'
import { router } from 'expo-router'
import { ChevronRightIcon } from 'lucide-react-native'
import * as React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FloatingSearch } from '@/components/floating-search'
import { PageHeader } from '@/components/page-header'
import { RequireProfile } from '@/components/require-profile'
import { Card, Muted } from '@/components/ui'
import { getGameIcon } from '@/games/registry'

const H_PAD = 16

function gameMatchesFilter(
  game: (typeof gameEngines)[number],
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    game.name.toLowerCase().includes(q) ||
    game.tagline.toLowerCase().includes(q) ||
    game.id.toLowerCase().includes(q)
  )
}

export default function HostScreen() {
  const insets = useSafeAreaInsets()
  const [filter, setFilter] = React.useState('')
  const [listBottomPad, setListBottomPad] = React.useState(84)
  const filtered = gameEngines.filter((game) => gameMatchesFilter(game, filter))

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: H_PAD,
          paddingBottom: listBottomPad,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View className="w-full max-w-xl gap-3 self-center">
          <PageHeader title="Browse the shelf" />
          <RequireProfile>
            <View className="gap-3">
              {filtered.length === 0 ? (
                <Card className="items-center px-6 py-10">
                  <Muted className="text-center">No games match “{filter.trim()}”.</Muted>
                </Card>
              ) : (
                filtered.map((game) => {
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
                          <Muted className="text-sm">{game.tagline}</Muted>
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
                })
              )}
            </View>
          </RequireProfile>
        </View>
      </ScrollView>

      <FloatingSearch
        value={filter}
        onChange={setFilter}
        placeholder="Filter games"
        searchLabel="Search games"
        onBottomPadChange={setListBottomPad}
      />
    </View>
  )
}
