import Constants from 'expo-constants'
import * as Clipboard from 'expo-clipboard'
import * as React from 'react'
import { Pressable, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { toast } from '@/lib/toast'

export function webJoinUrl(code: string): string {
  const base = (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ?? 'https://playjames.com'
  return `${base.replace(/\/$/, '')}/join/${code}`
}

export function QrCard({ code }: { code: string }) {
  const url = webJoinUrl(code)
  return (
    <View className="items-center gap-4 py-2">
      <View className="rounded-2xl bg-white p-4">
        <QRCode value={url} size={176} backgroundColor="#ffffff" color="#0c0c0f" />
      </View>
      <View className="items-center">
        <Text className="font-mono text-4xl font-bold text-primary" style={{ letterSpacing: 10 }}>
          {code}
        </Text>
        <Text className="mt-1 text-center text-xs text-muted-foreground">
          Scan to join from any phone — no app required
        </Text>
      </View>
      <Pressable
        className="rounded-lg bg-muted px-3 py-2 active:opacity-70"
        onPress={async () => {
          await Clipboard.setStringAsync(url)
          toast('Join link copied')
        }}
      >
        <Text className="text-sm font-medium text-zinc-100">Copy join link</Text>
      </Pressable>
    </View>
  )
}
