import * as React from 'react'
import { Text, View } from 'react-native'
import { AppTextInput } from '@/components/app-text-input'
import { EmojiGrid } from '@/components/emoji-grid'
import { AppButton, SectionLabel } from '@/components/ui'
import { useProfile } from '@/lib/profile'

/** Shared name + emoji editor used by the profile screen and the profile gate. */
export function ProfileForm({
  submitLabel = 'Save',
  onDone,
}: {
  submitLabel?: string
  onDone?: () => void
}) {
  const { name, emoji, setName, setEmoji } = useProfile()
  const [draftName, setDraftName] = React.useState(name)
  const [draftEmoji, setDraftEmoji] = React.useState(emoji)

  const save = () => {
    if (!draftName.trim()) return
    setName(draftName)
    setEmoji(draftEmoji)
    onDone?.()
  }

  return (
    <View className="gap-4">
      <View>
        <SectionLabel>Name</SectionLabel>
        <AppTextInput
          value={draftName}
          onChangeText={setDraftName}
          placeholder="e.g. Robin"
          placeholderTextColor="rgba(255,255,255,0.25)"
          maxLength={24}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={save}
          className="h-12 rounded-xl border border-line bg-field px-3 text-base text-zinc-100"
        />
      </View>
      <View>
        <SectionLabel>Emoji</SectionLabel>
        <EmojiGrid value={draftEmoji} onChange={setDraftEmoji} />
      </View>
      <AppButton title={submitLabel} onPress={save} disabled={!draftName.trim()} />
      <Text className="text-center text-xs text-muted-foreground/70">
        Lives only on this device. It's what other players see at the table.
      </Text>
    </View>
  )
}
