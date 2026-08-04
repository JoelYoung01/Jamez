import { isValidJoinCode, JOIN_CODE_LENGTH, normalizeJoinCode } from '@jamez/core'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import * as React from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, Muted, Screen, Spinner } from '@/components/ui'

/** Pull a join code out of whatever the QR contains (join URL or bare code). */
function extractJoinCode(data: string): string | null {
  const fromUrl = data.toUpperCase().match(new RegExp(`(?:JOIN|SESSION)/([A-Z0-9]{${JOIN_CODE_LENGTH}})`))
  if (fromUrl?.[1]) {
    const code = normalizeJoinCode(fromUrl[1])
    if (isValidJoinCode(code)) return code
  }
  const bare = normalizeJoinCode(data)
  return isValidJoinCode(bare) ? bare : null
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const handled = React.useRef(false)

  const onScanned = ({ data }: { data: string }) => {
    if (handled.current) return
    const code = extractJoinCode(data)
    if (!code) return
    handled.current = true
    router.replace(`/session/${code}`)
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }}>
        <PageHeader title="Scan to join" />
        {!permission ? (
          <Spinner />
        ) : !permission.granted ? (
          <Card className="items-center gap-4 p-6">
            <Text className="text-4xl">📷</Text>
            <Text className="text-center text-sm text-muted-foreground">
              Jamez needs the camera to scan the host's QR code. Nothing is recorded — it only
              looks for the join code.
            </Text>
            <AppButton title="Allow camera access" onPress={() => void requestPermission()} />
            <AppButton variant="ghost" title="Type the code instead" onPress={() => router.replace('/join')} />
          </Card>
        ) : (
          <View className="gap-4">
            <View className="overflow-hidden rounded-2xl border border-line" style={{ height: 360 }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onScanned}
              />
            </View>
            <Muted className="text-center">
              Point at the QR on the host's screen — you'll hop straight into their lobby.
            </Muted>
            <AppButton variant="outline" title="Type the code instead" onPress={() => router.replace('/join')} />
          </View>
        )}
      </View>
    </Screen>
  )
}
