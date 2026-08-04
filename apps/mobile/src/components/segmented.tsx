import { clsx } from 'clsx'
import * as React from 'react'
import { Pressable, Text, View } from 'react-native'

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View className="flex-row items-center rounded-xl bg-muted p-1">
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          className={clsx(
            'flex-1 items-center rounded-lg px-3 py-2',
            value === option.value && 'bg-background',
          )}
        >
          <Text
            className={clsx(
              'text-sm font-medium',
              value === option.value ? 'text-zinc-100' : 'text-muted-foreground',
            )}
            numberOfLines={1}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
