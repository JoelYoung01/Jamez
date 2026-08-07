import * as React from 'react'
import { Platform, TextInput, type TextInputProps } from 'react-native'
import { KeyboardDismissAccessory } from '@/components/keyboard-dismiss'

let accessorySeq = 0

export type AppTextInputProps = TextInputProps & {
  /**
   * When false, skip the default iOS dismiss accessory. Use for surfaces that
   * already incorporate dismiss into their own keyboard chrome (e.g. cash sheet).
   */
  keyboardAccessory?: boolean
}

/**
 * Drop-in TextInput that attaches a keyboard dismiss accessory on iOS.
 * Pass `inputAccessoryViewID` yourself to opt into a custom accessory (and
 * skip the default dismiss bar). Pass `keyboardAccessory={false}` to attach none.
 */
export const AppTextInput = React.forwardRef<TextInput, AppTextInputProps>(
  function AppTextInput(
    { inputAccessoryViewID, keyboardAccessory = true, autoFocus, ...props },
    ref,
  ) {
    const autoId = React.useRef(`jamez-kbd-${++accessorySeq}`).current
    const useDefault =
      Platform.OS === 'ios' && keyboardAccessory && inputAccessoryViewID == null
    const accessoryId = inputAccessoryViewID ?? (useDefault ? autoId : undefined)

    const innerRef = React.useRef<TextInput>(null)
    const setRefs = React.useCallback(
      (node: TextInput | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref],
    )

    // iOS omits InputAccessoryView when focus races the accessory mount (common
    // with autoFocus inside Modals). Focus after the accessory has registered.
    React.useEffect(() => {
      if (!autoFocus) return
      let timer: ReturnType<typeof setTimeout> | undefined
      const frame = requestAnimationFrame(() => {
        timer = setTimeout(() => innerRef.current?.focus(), 50)
      })
      return () => {
        cancelAnimationFrame(frame)
        if (timer) clearTimeout(timer)
      }
    }, [autoFocus])

    return (
      <>
        {useDefault ? <KeyboardDismissAccessory nativeID={autoId} /> : null}
        <TextInput
          ref={setRefs}
          {...props}
          autoFocus={false}
          inputAccessoryViewID={accessoryId}
        />
      </>
    )
  },
)
