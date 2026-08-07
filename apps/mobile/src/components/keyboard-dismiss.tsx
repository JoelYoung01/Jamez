import { clsx } from 'clsx'
import { CheckIcon } from 'lucide-react-native'
import * as React from 'react'
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native'
import { useKeyboardHeight } from '@/lib/keyboard'

/** Blur the focused field and hide the keyboard. */
export function dismissKeyboard() {
  const focused = TextInput.State.currentlyFocusedInput()
  if (focused) focused.blur()
  Keyboard.dismiss()
}

/** Check button that sits at the trailing edge of a keyboard accessory bar. */
export function KeyboardDismissButton() {
  return (
    <Pressable
      accessibilityLabel="Dismiss keyboard"
      hitSlop={6}
      onPress={dismissKeyboard}
      className="h-10 w-10 items-center justify-center rounded-lg active:opacity-70"
    >
      <CheckIcon size={22} color="#fbbf24" />
    </Pressable>
  )
}

/** Default accessory chrome: empty leading side, dismiss on the right. */
export function KeyboardDismissBar({
  leading,
  className,
}: {
  leading?: React.ReactNode
  className?: string
}) {
  return (
    <View
      className={clsx(
        'flex-row items-center justify-between bg-card px-2 py-1.5',
        className,
      )}
    >
      <View className="flex-row items-center gap-0.5">{leading}</View>
      <KeyboardDismissButton />
    </View>
  )
}

/** iOS accessory view wired to a stable nativeID. */
export function KeyboardDismissAccessory({ nativeID }: { nativeID: string }) {
  if (Platform.OS !== 'ios') return null
  return (
    <InputAccessoryView nativeID={nativeID}>
      <KeyboardDismissBar className="border-t border-line" />
    </InputAccessoryView>
  )
}

/**
 * Android has no InputAccessoryView. With `softwareKeyboardLayoutMode: 'resize'`
 * the window already sits above the keyboard, so pin the dismiss bar to the
 * bottom of that resized window.
 */
export function AndroidKeyboardDismissHost() {
  const keyboardHeight = useKeyboardHeight()
  if (Platform.OS === 'ios' || keyboardHeight <= 0) return null

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1000 }}
    >
      <KeyboardDismissBar className="border-t border-line" />
    </View>
  )
}
