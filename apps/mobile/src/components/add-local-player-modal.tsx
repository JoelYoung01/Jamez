import { rosterAvailableForSession, type RosterPlayer } from '@jamez/core'
import { UserPlusIcon } from 'lucide-react-native'
import * as React from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { AppTextInput } from '@/components/app-text-input'
import { EmojiGrid } from '@/components/emoji-grid'
import {
  KeyboardActionButtons,
  KeyboardForm,
  useSuppressAndroidKeyboardHost,
} from '@/components/keyboard-dismiss'
import { AppButton, Chip, SectionLabel } from '@/components/ui'
import { useKeyboardHeight } from '@/lib/keyboard'
import { usePlayerRoster } from '@/lib/player-roster'
import { randomEmoji } from '@/lib/profile'
import { useSession } from '@/lib/session-store'

export type AddLocalPlayerProfile = {
  name: string
  emoji: string
  id?: string
  photo?: string
}

export function AddLocalPlayerModal({
  title = 'Add a local player',
  confirmLabel = 'Add player',
  namePlaceholder = 'e.g. Grandma',
  onClose,
  onConfirm,
}: {
  title?: string
  confirmLabel?: string
  namePlaceholder?: string
  onClose: () => void
  onConfirm: (profile: AddLocalPlayerProfile) => void
}) {
  const keyboardHeight = useKeyboardHeight()
  const players = useSession((s) => s.state?.players)
  const entries = usePlayerRoster((s) => s.entries)
  const available = React.useMemo(
    () => rosterAvailableForSession(entries, players?.map((p) => p.id) ?? []),
    [entries, players],
  )
  const [name, setName] = React.useState('')
  const [emoji, setEmoji] = React.useState(randomEmoji())
  useSuppressAndroidKeyboardHost()

  const add = React.useCallback(() => {
    if (!name.trim()) return
    onConfirm({ name: name.trim(), emoji })
  }, [emoji, name, onConfirm])

  const pickRecent = (player: RosterPlayer) => {
    onConfirm({
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      ...(player.photo ? { photo: player.photo } : {}),
    })
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          className="rounded-t-3xl border border-line bg-card"
          style={{ marginBottom: keyboardHeight, maxHeight: '90%' }}
        >
          <KeyboardForm onSubmit={add}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                padding: 16,
                gap: 12,
                paddingBottom: keyboardHeight > 0 ? 56 : 16,
              }}
            >
              <Text className="text-lg font-semibold text-zinc-100">{title}</Text>
              {available.length > 0 ? (
                <View className="gap-2">
                  <SectionLabel>Recent players</SectionLabel>
                  <View className="gap-1.5">
                    {available.map((player) => (
                      <Pressable
                        key={player.id}
                        onPress={() => pickRecent(player)}
                        className="flex-row items-center gap-3 rounded-xl border border-line bg-background/40 px-3 py-2 active:opacity-80"
                      >
                        <Text className="text-lg leading-none">{player.emoji}</Text>
                        <Text
                          className="min-w-0 flex-1 text-sm font-medium text-zinc-100"
                          numberOfLines={1}
                        >
                          {player.name}
                        </Text>
                        <Chip tone="outline">{player.source}</Chip>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <View>
                <SectionLabel>{available.length > 0 ? 'Create new' : 'Name'}</SectionLabel>
                <AppTextInput
                  autoFocus={available.length === 0}
                  keyboardAccessory={false}
                  value={name}
                  onChangeText={setName}
                  placeholder={namePlaceholder}
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  maxLength={24}
                  returnKeyType="done"
                  onSubmitEditing={add}
                  className="h-12 rounded-xl border border-line bg-field px-3 text-base text-zinc-100"
                />
              </View>
              <View>
                <SectionLabel>Emoji</SectionLabel>
                <EmojiGrid value={emoji} onChange={setEmoji} />
              </View>
              <View className="flex-row gap-2">
                <AppButton title="Cancel" variant="secondary" className="flex-1" onPress={onClose} />
                <AppButton
                  title={confirmLabel}
                  className="flex-1"
                  disabled={!name.trim()}
                  onPress={add}
                />
              </View>
            </ScrollView>
            {keyboardHeight > 0 ? (
              <View pointerEvents="box-none" className="absolute bottom-1.5 right-2">
                <KeyboardActionButtons floating />
              </View>
            ) : null}
          </KeyboardForm>
        </View>
      </View>
    </Modal>
  )
}

/** Trigger + modal for host lobbies / banks. */
export function AddLocalPlayerButton({
  triggerLabel = 'Local player',
  title = 'Add a local player',
  confirmLabel = 'Add player',
  namePlaceholder = 'e.g. Grandma',
}: {
  triggerLabel?: string
  title?: string
  confirmLabel?: string
  namePlaceholder?: string
}) {
  const addLocalPlayer = useSession((s) => s.addLocalPlayer)
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <AppButton
        variant="outline"
        size="sm"
        title={triggerLabel}
        icon={<UserPlusIcon size={14} color="#f4f4f5" />}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <AddLocalPlayerModal
          title={title}
          confirmLabel={confirmLabel}
          namePlaceholder={namePlaceholder}
          onClose={() => setOpen(false)}
          onConfirm={(profile) => {
            addLocalPlayer(profile)
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
