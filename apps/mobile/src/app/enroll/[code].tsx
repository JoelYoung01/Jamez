import { EnrollGuest, createNostrTransport, isValidJoinCode, normalizeJoinCode } from '@jamez/core'
import { useLocalSearchParams } from 'expo-router'
import * as React from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { RequireProfile } from '@/components/require-profile'
import { Card, Screen } from '@/components/ui'
import { currentProfile } from '@/lib/profile'
import { activeRelays } from '@/lib/settings'

export default function EnrollScreen() {
  return (
    <RequireProfile>
      <EnrollBody />
    </RequireProfile>
  )
}

function EnrollBody() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ code: string }>()
  const code = normalizeJoinCode(params.code ?? '')
  const [status, setStatus] = React.useState<'working' | 'done' | 'invalid'>('working')

  React.useEffect(() => {
    if (!isValidJoinCode(code)) {
      setStatus('invalid')
      return
    }
    const guest = new EnrollGuest({
      code,
      profile: currentProfile(),
      transport: createNostrTransport({ code, relays: activeRelays() }),
    })
    const unsubscribe = guest.onEnrolled.subscribe(() => setStatus('done'))
    guest.start()
    return () => {
      unsubscribe()
      guest.stop()
    }
  }, [code])

  const body =
    status === 'invalid'
      ? 'That code is not valid.'
      : status === 'done'
        ? 'The host can add you to a game later. You can close this screen.'
        : 'Sending your name to the host…'

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }}>
        <PageHeader title={status === 'done' ? 'You’re in their player list' : 'Adding you'} />
        <Card className="p-4">
          <Text className="text-sm text-muted-foreground">{body}</Text>
        </Card>
      </View>
    </Screen>
  )
}
