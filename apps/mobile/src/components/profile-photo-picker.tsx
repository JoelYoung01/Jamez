import * as React from 'react'
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native'
import { pickAndDownscaleProfilePhoto } from '@/lib/avatar-image'
import { toast } from '@/lib/toast'

export function ProfilePhotoPicker({
  emoji,
  photo,
  onChange,
}: {
  emoji: string
  photo: string | undefined
  onChange: (photo: string | undefined) => void
}) {
  const [busy, setBusy] = React.useState(false)

  const pick = async () => {
    setBusy(true)
    try {
      const next = await pickAndDownscaleProfilePhoto()
      if (next) onChange(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not use that photo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="flex-row items-center gap-3">
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-line bg-muted">
        {photo ? (
          <Image source={{ uri: photo }} className="h-14 w-14" />
        ) : (
          <Text className="text-2xl">{emoji}</Text>
        )}
      </View>
      <View className="flex-1 flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => void pick()}
          disabled={busy}
          className="h-10 flex-row items-center justify-center rounded-xl bg-secondary px-3"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-sm font-medium text-zinc-100">
              {photo ? 'Change photo' : 'Add photo'}
            </Text>
          )}
        </Pressable>
        {photo ? (
          <Pressable
            onPress={() => onChange(undefined)}
            disabled={busy}
            className="h-10 items-center justify-center rounded-xl px-3"
          >
            <Text className="text-sm text-muted-foreground">Remove</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
