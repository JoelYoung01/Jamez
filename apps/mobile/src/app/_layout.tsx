import '../polyfills'
import '../global.css'

import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as React from 'react'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useProfileHydrated } from '@/lib/profile'
import { ToastHost } from '@/lib/toast'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const hydrated = useProfileHydrated()

  React.useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {})
  }, [hydrated])

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
      </View>
    </SafeAreaProvider>
  )
}
