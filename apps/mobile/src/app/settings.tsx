import { DEFAULT_RELAYS } from '@jamez/core'
import { router } from 'expo-router'
import * as React from 'react'
import { TextInput, View } from 'react-native'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, Muted, Screen, SectionLabel } from '@/components/ui'
import { useSettings } from '@/lib/settings'
import { toast } from '@/lib/toast'

export default function SettingsScreen() {
  const { customRelays, setCustomRelays } = useSettings()
  const [draft, setDraft] = React.useState((customRelays ?? []).join('\n'))

  const save = () => {
    const relays = draft
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.startsWith('ws://') || r.startsWith('wss://'))
    setCustomRelays(relays.length > 0 ? relays : null)
    toast(relays.length > 0 ? 'Using custom relays' : 'Using default relays')
    router.back()
  }

  return (
    <Screen>
      <View className="pt-4">
        <PageHeader title="Relays" />
        <Card className="gap-4 p-5">
          <Muted className="text-sm leading-5">
            Sessions travel through Nostr relays as end-to-end encrypted, ephemeral messages.
            Nothing is stored anywhere. Leave empty to use the default public relays, or point at
            your own (run `pnpm relay` on any machine for a fully offline LAN game night).
          </Muted>
          <View>
            <SectionLabel>Custom relays (one per line)</SectionLabel>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={DEFAULT_RELAYS.join('\n')}
              placeholderTextColor="rgba(255,255,255,0.2)"
              multiline
              numberOfLines={4}
              autoCapitalize="none"
              autoCorrect={false}
              className="min-h-24 rounded-xl border border-line bg-field px-3 py-2.5 font-mono text-xs text-zinc-100"
              style={{ textAlignVertical: 'top' }}
            />
          </View>
          <View className="flex-row gap-2">
            <AppButton variant="ghost" title="Use defaults" className="flex-1" onPress={() => setDraft('')} />
            <AppButton title="Save" className="flex-1" onPress={save} />
          </View>
        </Card>
      </View>
    </Screen>
  )
}
