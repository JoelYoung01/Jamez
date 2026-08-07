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
 * Android has no InputAccessoryView. When the keyboard is open, pin a dismiss
 * bar just above it so number pads (and every other keyboard) can be closed.
 */
export function AndroidKeyboardDismissHost() {
  const [height, setHeight] = React.useState(0)

  React.useEffect(() => {
    if (Platform.OS === 'ios') return
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setHeight(e.endCoordinates.height)
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  if (Platform.OS === 'ios' || height <= 0) return null

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: height, zIndex: 1000 }}
    >
      <KeyboardDismissBar className="border-t border-line" />
    </View>
  )
}
