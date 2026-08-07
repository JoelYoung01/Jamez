import * as React from 'react'
import { Keyboard, Platform } from 'react-native'

/** Approximate height of our keyboard dismiss accessory bar. */
export const KEYBOARD_DISMISS_BAR_HEIGHT = 46

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
