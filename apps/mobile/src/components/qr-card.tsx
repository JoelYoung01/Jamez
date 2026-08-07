import Constants from 'expo-constants'
import * as Clipboard from 'expo-clipboard'
import { CheckIcon, CopyIcon } from 'lucide-react-native'
import * as React from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { toast } from '@/lib/toast'

export function webJoinUrl(code: string): string {
  const base = (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ?? 'https://playjamez.com'
  return `${base.replace(/\/$/, '')}/join/${code}`
}

export function QrCard({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false)
  const scale = React.useRef(new Animated.Value(1)).current
  const url = webJoinUrl(code)

  const copyJoinLink = async () => {
    await Clipboard.setStringAsync(url)
    setCopied(true)
    toast('Join link copied')
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.2, useNativeDriver: true, speed: 40, bounciness: 8 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start()
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View className="items-center gap-4 py-2">
      <View className="rounded-2xl bg-white p-4">
        <QRCode value={url} size={176} backgroundColor="#ffffff" color="#0c0c0f" />
      </View>
      <View className="items-center">
        <View className="flex-row items-center gap-2">
          <Text className="font-mono text-4xl font-bold text-primary" style={{ letterSpacing: 10 }}>
            {code}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copied ? 'Join link copied' : 'Copy join link'}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-lg bg-muted active:opacity-70"
            onPress={() => {
              void copyJoinLink()
            }}
          >
            <Animated.View style={{ transform: [{ scale }] }}>
              {copied ? (
                <CheckIcon size={18} color="#6ee7b7" />
              ) : (
                <CopyIcon size={18} color="#a1a1ab" />
              )}
            </Animated.View>
          </Pressable>
        </View>
        <Text className="mt-1 text-center text-xs text-muted-foreground">
          Scan to join from any phone. No app required.
        </Text>
      </View>
    </View>
  )
}
