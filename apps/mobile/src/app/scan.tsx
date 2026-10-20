import { isValidJoinCode, JOIN_CODE_LENGTH, normalizeJoinCode } from '@jamez/core'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { CameraIcon } from 'lucide-react-native'
import * as React from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, Muted, Screen, Spinner } from '@/components/ui'

/** Pull a join or enroll code out of a QR (URL or bare join code). */
function extractCode(data: string): { kind: 'join' | 'enroll'; code: string } | null {
  const enroll = data.toUpperCase().match(new RegExp(`ENROLL/([A-Z0-9]{${JOIN_CODE_LENGTH}})`))
  if (enroll?.[1] && isValidJoinCode(normalizeJoinCode(enroll[1]))) {
    return { kind: 'enroll', code: normalizeJoinCode(enroll[1]) }
  }
  const fromUrl = data.toUpperCase().match(new RegExp(`(?:JOIN|SESSION)/([A-Z0-9]{${JOIN_CODE_LENGTH}})`))
  if (fromUrl?.[1] && isValidJoinCode(normalizeJoinCode(fromUrl[1]))) {
    return { kind: 'join', code: normalizeJoinCode(fromUrl[1]) }
  }
  const bare = normalizeJoinCode(data)
  return isValidJoinCode(bare) ? { kind: 'join', code: bare } : null
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const handled = React.useRef(false)

  const onScanned = ({ data }: { data: string }) => {
    if (handled.current) return
    const found = extractCode(data)
    if (!found) return
    handled.current = true
    router.replace(found.kind === 'enroll' ? `/enroll/${found.code}` : `/session/${found.code}`)
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }}>
        <PageHeader title="Scan to join" />
        {!permission ? (
          <Spinner />
        ) : !permission.granted ? (
          <Card className="items-center gap-4 p-6">
            <CameraIcon size={36} color="#a1a1ab" />
            <Text className="text-center text-sm text-muted-foreground">
              Jamez needs the camera to scan the host's QR code. Nothing is recorded; it only
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
              Point at the QR on the host's screen. You'll hop straight into their lobby.
            </Muted>
            <AppButton variant="outline" title="Type the code instead" onPress={() => router.replace('/join')} />
          </View>
        )}
      </View>
    </Screen>
  )
}
