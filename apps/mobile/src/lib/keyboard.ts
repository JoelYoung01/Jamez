import * as React from 'react'
import { Keyboard, Platform, type ScrollView, type TextInput } from 'react-native'

/** Approximate height of our keyboard dismiss accessory bar. */
export const KEYBOARD_DISMISS_BAR_HEIGHT = 46

/** Extra clearance above the keyboard when scrolling a focused field into view. */
export const KEYBOARD_SCROLL_EXTRA_OFFSET = 20

/** Subscribe to keyboard height (0 when hidden). */
export function useKeyboardHeight() {
  const [height, setHeight] = React.useState(0)

  React.useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return height
}

/**
 * Extra bottom padding so ScrollView content can clear the keyboard.
 * iOS overlays the keyboard (pad by full frame, which includes InputAccessoryView).
 * Android uses adjustResize, so the window already shrinks — only clear our overlay bar.
 */
export function keyboardScrollPadding(keyboardHeight: number): number {
  if (keyboardHeight <= 0) return 0
  return Platform.OS === 'ios' ? keyboardHeight : KEYBOARD_DISMISS_BAR_HEIGHT
}

/**
 * Scroll a focused TextInput above the keyboard inside a ScrollView.
 * Uses RN's built-in keyboard-aware scroller (waits a tick if metrics aren't ready yet).
 */
export function scrollInputAboveKeyboard(
  scrollView: ScrollView | null | undefined,
  input: TextInput | null | undefined,
  additionalOffset: number = KEYBOARD_SCROLL_EXTRA_OFFSET,
) {
  if (!scrollView || !input) return
  scrollView.scrollResponderScrollNativeHandleToKeyboard(input, additionalOffset, true)
}

export type ScreenScrollApi = {
  scrollInputAboveKeyboard: (
    input: TextInput | null | undefined,
    additionalOffset?: number,
  ) => void
}

export const ScreenScrollContext = React.createContext<ScreenScrollApi | null>(null)

/** Scroll the given input above the keyboard within the nearest Screen ScrollView. */
export function useScrollInputAboveKeyboard() {
  return React.useContext(ScreenScrollContext)?.scrollInputAboveKeyboard
}
