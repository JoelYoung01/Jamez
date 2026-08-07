import { isValidJoinCode } from '@jamez/core'
import { router } from 'expo-router'
import * as React from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CodeInput } from '@/components/code-input'
import { PageHeader } from '@/components/page-header'
import { RequireProfile } from '@/components/require-profile'
import { AppButton, Card, CardTitle, Screen } from '@/components/ui'
import { useSession } from '@/lib/session-store'

export default function JoinScreen() {
  const insets = useSafeAreaInsets()
  const joinGame = useSession((s) => s.joinGame)
  const [code, setCode] = React.useState('')

  const join = () => {
    if (!isValidJoinCode(code)) return
    joinGame(code)
    router.replace(`/session/${code.toUpperCase()}`)
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }}>
        <PageHeader title="Join a game" />
        <RequireProfile>
          <View className="gap-4">
            <AppButton size="lg" title="Scan the host's QR code" icon={null} onPress={() => router.push('/scan')} />
            <Card className="gap-4 p-4">
              <CardTitle>…or enter the join code</CardTitle>
              <View className="gap-4">
                <CodeInput value={code} onChange={setCode} onSubmit={join} />
                <AppButton title="Join session" disabled={!isValidJoinCode(code)} onPress={join} />
              </View>
            </Card>
          </View>
        </RequireProfile>
      </View>
    </Screen>
  )
}
