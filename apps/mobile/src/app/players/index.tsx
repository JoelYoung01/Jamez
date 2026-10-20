import {
  EnrollHost,
  createNostrTransport,
  generateJoinCode,
  libraryDisplayName,
  libraryPlayerByClientId,
  randomId,
} from '@jamez/core'
import { router } from 'expo-router'
import { SmartphoneIcon } from 'lucide-react-native'
import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppTextInput } from '@/components/app-text-input'
import { PageHeader } from '@/components/page-header'
import { webJoinUrl } from '@/components/qr-card'
import { AppButton, Card, Muted, Screen } from '@/components/ui'
import { usePlayerRoster } from '@/lib/player-roster'
import { currentProfile, randomEmoji } from '@/lib/profile'
import { activeRelays } from '@/lib/settings'
import { toast } from '@/lib/toast'

function enrollUrl(code: string): string {
  return webJoinUrl(code).replace('/join/', '/enroll/')
}

export default function PlayersScreen() {
  const insets = useSafeAreaInsets()
  const entries = usePlayerRoster((s) => s.entries)
  const upsert = usePlayerRoster((s) => s.upsert)
  const setInactive = usePlayerRoster((s) => s.setInactive)
  const [query, setQuery] = React.useState('')
  const [showInactive, setShowInactive] = React.useState(false)
  const [enrollCode, setEnrollCode] = React.useState<string | null>(null)
  const [name, setName] = React.useState('')

  React.useEffect(() => {
    if (!enrollCode) return
    const host = new EnrollHost({
      code: enrollCode,
      hostId: currentProfile().id,
      transport: createNostrTransport({ code: enrollCode, relays: activeRelays() }),
      onEnroll(player) {
        const existing = libraryPlayerByClientId(usePlayerRoster.getState().entries, player.id)
        if (existing) {
          upsert({
            id: existing.id,
            name: player.name,
            emoji: player.emoji,
            clientIds: [...new Set([...existing.clientIds, player.id])],
            fromClient: true,
            inactive: false,
            ...(player.photo ? { photo: player.photo } : {}),
          })
          toast(`${player.name} updated`)
          return 'updated'
        }
        upsert({
          id: player.id,
          name: player.name,
          emoji: player.emoji,
          clientIds: [player.id],
          fromClient: true,
          inactive: false,
          ...(player.photo ? { photo: player.photo } : {}),
        })
        toast(`${player.name} added`)
        return 'added'
      },
    })
    host.start()
    return () => host.stop()
  }, [enrollCode, upsert])

  const visible = entries.filter((entry) => {
    if (!showInactive && entry.inactive) return false
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return `${libraryDisplayName(entry)} ${entry.name}`.toLowerCase().includes(needle)
  })

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-3">
        <PageHeader title="Players" />
        <Card className="gap-3 p-4">
          <Text className="text-sm font-semibold text-zinc-100">Add someone with their phone</Text>
          <Muted>The code works only while this QR is on screen.</Muted>
          {enrollCode ? (
            <View className="items-center gap-2">
              <View className="rounded-2xl bg-white p-4">
                <QRCode value={enrollUrl(enrollCode)} size={176} backgroundColor="#ffffff" color="#0c0c0f" />
              </View>
              <Text className="font-mono text-2xl font-bold text-primary">{enrollCode}</Text>
              <AppButton variant="ghost" title="Hide QR" onPress={() => setEnrollCode(null)} />
            </View>
          ) : (
            <AppButton variant="secondary" title="Show QR" onPress={() => setEnrollCode(generateJoinCode())} />
          )}
        </Card>
        <AppTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search players"
          placeholderTextColor="rgba(255,255,255,0.25)"
          className="h-11 rounded-xl border border-line bg-field px-3 text-base text-zinc-100"
        />
        <AppButton
          variant={showInactive ? 'secondary' : 'outline'}
          title={showInactive ? 'Showing inactive' : 'Active only'}
          onPress={() => setShowInactive((value) => !value)}
        />
        <View className="flex-row gap-2">
          <AppTextInput
            value={name}
            onChangeText={setName}
            placeholder="New player name"
            placeholderTextColor="rgba(255,255,255,0.25)"
            maxLength={24}
            className="h-11 flex-1 rounded-xl border border-line bg-field px-3 text-base text-zinc-100"
          />
          <AppButton
            title="Add"
            disabled={!name.trim()}
            onPress={() => {
              upsert({ id: randomId(8), name: name.trim(), emoji: randomEmoji(), clientIds: [] })
              setName('')
            }}
          />
        </View>
        {visible.length === 0 ? (
          <Muted className="py-6 text-center">No players yet.</Muted>
        ) : (
          visible.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => setInactive(entry.id, !entry.inactive)}
              className="flex-row items-center gap-3 rounded-2xl border border-line bg-card px-3 py-3"
            >
              <Text className="text-xl">{entry.emoji}</Text>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1">
                  <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>
                    {libraryDisplayName(entry)}
                  </Text>
                  {entry.clientIds.length > 0 ? <SmartphoneIcon size={14} color="#a1a1ab" /> : null}
                </View>
                <Muted>{entry.inactive ? 'Inactive · tap to activate' : 'Tap to make inactive'}</Muted>
              </View>
              <AppButton title="Merge" variant="outline" size="sm" onPress={() => router.push(`/players/merge/${entry.id}`)} />
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  )
}
