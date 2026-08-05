import { router } from 'expo-router'
import { ChevronLeftIcon } from 'lucide-react-native'
import type * as React from 'react'
import { Pressable, Text, View } from 'react-native'

export function PageHeader({
  title,
  icon,
  right,
  back = true,
}: {
  title: string
  icon?: React.ReactNode
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
          <ChevronLeftIcon size={18} color="#f4f4f5" />
        </Pressable>
      )}
      {icon}
      <Text className="flex-1 text-lg font-semibold text-zinc-100" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  )
}
