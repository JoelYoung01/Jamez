import { router } from 'expo-router'
import type * as React from 'react'
import { Pressable, Text, View } from 'react-native'

export function PageHeader({
  title,
  emoji,
  right,
  back = true,
}: {
  title: string
  emoji?: string
  right?: React.ReactNode
  back?: boolean
}) {
  return (
    <View className="mb-4 flex-row items-center gap-2.5">
      {back && (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-lg bg-muted active:opacity-70"
        >
          <Text className="text-base font-semibold text-zinc-100">‹</Text>
        </Pressable>
      )}
      {emoji ? <Text className="text-xl">{emoji}</Text> : null}
      <Text className="flex-1 text-lg font-semibold text-zinc-100" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  )
}
