import { clsx } from 'clsx'
import { Pressable, Text, View } from 'react-native'
import { PLAYER_EMOJI } from '@/lib/profile'

export function EmojiGrid({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {PLAYER_EMOJI.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => onChange(emoji)}
          className={clsx(
            'h-10 w-10 items-center justify-center rounded-lg',
            value === emoji ? 'border-2 border-primary bg-primary/20' : 'bg-muted',
          )}
        >
          <Text className="text-xl">{emoji}</Text>
        </Pressable>
      ))}
    </View>
  )
}
