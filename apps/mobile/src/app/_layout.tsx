import '../polyfills'
import '../global.css'

import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as React from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AndroidKeyboardDismissHost } from '@/components/keyboard-dismiss'
import { useProfileHydrated } from '@/lib/profile'
import { useSession } from '@/lib/session-store'
import { ToastHost } from '@/lib/toast'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const hydrated = useProfileHydrated()
  const restoreActiveHost = useSession((s) => s.restoreActiveHost)

  React.useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {})
  }, [hydrated])

  // Vault rows marked `active` should keep transport (+ Live Activity) up.
  React.useEffect(() => {
    if (!hydrated) return
    void restoreActiveHost()
  }, [hydrated, restoreActiveHost])

  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-background">
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0e0e12' },
          }}
        >
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        </Stack>
        <ToastHost />
        <AndroidKeyboardDismissHost />
      </View>
    </SafeAreaProvider>
  )
}
