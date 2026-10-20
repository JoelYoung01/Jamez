import { libraryDisplayName, type LibraryMergeChoices, type PlayerMergeMode } from '@jamez/core'
import { router, useLocalSearchParams } from 'expo-router'
import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, Muted, Screen } from '@/components/ui'
import { usePlayerRoster } from '@/lib/player-roster'
import { useSession } from '@/lib/session-store'
import { toast } from '@/lib/toast'

export default function MergePlayerScreen() {
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const entries = usePlayerRoster((s) => s.entries)
  const merge = usePlayerRoster((s) => s.merge)
  const state = useSession((s) => s.state)
  const mergeSeats = useSession((s) => s.mergePlayers)
  const source = entries.find((entry) => entry.id === id)
  const others = entries.filter((entry) => entry.id !== id)
  const [otherId, setOtherId] = React.useState(others[0]?.id ?? '')
  const [survivor, setSurvivor] = React.useState<'source' | 'other'>('other')
  const [mode, setMode] = React.useState<PlayerMergeMode>('combine')
  const other = entries.find((entry) => entry.id === otherId)

  const confirm = () => {
    if (!source || !other) return
    const from = survivor === 'source' ? other : source
    const to = survivor === 'source' ? source : other
    const choices: LibraryMergeChoices = { name: 'to', emoji: 'to', photo: 'to', alias: 'to' }
    const bothSeated = Boolean(
      state?.players.some((player) => player.id === from.id) &&
        state?.players.some((player) => player.id === to.id),
    )
    if (bothSeated) {
      const error = mergeSeats(from.id, to.id, mode, { name: to.name, emoji: to.emoji })
      if (error === false) return
    }
    const libraryError = merge(from.id, to.id, choices)
    if (libraryError) {
      toast.error(libraryError)
      return
    }
    toast('Players merged')
    router.back()
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-3">
        <PageHeader title="Merge players" />
        {!source ? (
          <Muted>That player is not in the library.</Muted>
        ) : (
          <>
            <Muted>Keep both phones on the survivor. Pick who remains.</Muted>
            {others.map((entry) => (
              <Pressable key={entry.id} onPress={() => setOtherId(entry.id)}>
                <Card className={`p-3 ${entry.id === otherId ? 'border-primary' : ''}`}>
                  <Text className="text-sm text-zinc-100">
                    {entry.emoji} {libraryDisplayName(entry)}
                  </Text>
                </Card>
              </Pressable>
            ))}
            <View className="flex-row gap-2">
              <AppButton
                title={other ? `Keep ${libraryDisplayName(other)}` : 'Keep other'}
                variant={survivor === 'other' ? 'primary' : 'outline'}
                onPress={() => setSurvivor('other')}
              />
              <AppButton
                title={`Keep ${libraryDisplayName(source)}`}
                variant={survivor === 'source' ? 'primary' : 'outline'}
                onPress={() => setSurvivor('source')}
              />
            </View>
            <View className="flex-row gap-2">
              <AppButton
                title="Combine scores"
                variant={mode === 'combine' ? 'primary' : 'outline'}
                onPress={() => setMode('combine')}
              />
              <AppButton
                title="Keep survivor"
                variant={mode === 'keep' ? 'primary' : 'outline'}
                onPress={() => setMode('keep')}
              />
            </View>
            <AppButton title="Merge" onPress={confirm} disabled={!other} />
          </>
        )}
      </View>
    </Screen>
  )
}
