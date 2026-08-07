import * as React from 'react'
import { Platform, TextInput, type TextInputProps } from 'react-native'
import {
  KeyboardDismissAccessory,
  registerKeyboardField,
  setFocusedKeyboardField,
  useKeyboardFormGroup,
} from '@/components/keyboard-dismiss'

let accessorySeq = 0

export type AppTextInputProps = TextInputProps & {
  /**
   * When false, skip the default iOS dismiss accessory. Use for surfaces that
   * already incorporate dismiss into their own keyboard chrome (e.g. cash sheet).
   */
  keyboardAccessory?: boolean
}

function callSubmit(handler: TextInputProps['onSubmitEditing']) {
  if (!handler) return
  // Callers almost always ignore the event; synthesize a minimal stand-in.
  handler({ nativeEvent: { text: '' } } as unknown as Parameters<NonNullable<typeof handler>>[0])
}

/**
 * Drop-in TextInput that attaches a keyboard accessory on iOS (check = next /
 * submit, chevron = dismiss) and registers with the field roster so Android's
 * floating host can do the same.
 *
 * Pass `inputAccessoryViewID` yourself to opt into a custom accessory (and
 * skip the default bar). Pass `keyboardAccessory={false}` to attach none.
 */
export const AppTextInput = React.forwardRef<TextInput, AppTextInputProps>(
  function AppTextInput(
    {
      inputAccessoryViewID,
      keyboardAccessory = true,
      autoFocus,
      onSubmitEditing,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) {
    const autoId = React.useRef(`jamez-kbd-${++accessorySeq}`).current
    const group = useKeyboardFormGroup()
    const useDefault =
      Platform.OS === 'ios' && keyboardAccessory && inputAccessoryViewID == null
    const accessoryId = inputAccessoryViewID ?? (useDefault ? autoId : undefined)

    const innerRef = React.useRef<TextInput>(null)
    const submitRef = React.useRef(onSubmitEditing)
    submitRef.current = onSubmitEditing
    const unregisterRef = React.useRef<(() => void) | null>(null)

    const hasSubmit = Boolean(onSubmitEditing)

    const setRefs = React.useCallback(
      (node: TextInput | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node

        unregisterRef.current?.()
        unregisterRef.current = registerKeyboardField({
          id: autoId,
          input: node,
          group,
          // null → KeyboardForm onSubmit runs (check-to-save on single-field forms)
          submit: hasSubmit ? () => callSubmit(submitRef.current) : null,
        })
      },
      [autoId, group, hasSubmit, ref],
    )

    React.useEffect(() => {
      return () => {
        unregisterRef.current?.()
        unregisterRef.current = null
      }
    }, [])

    // Keep group/submit mapping fresh if the form group identity changes.
    React.useEffect(() => {
      if (!innerRef.current) return
      unregisterRef.current?.()
      unregisterRef.current = registerKeyboardField({
        id: autoId,
        input: innerRef.current,
        group,
        submit: hasSubmit ? () => callSubmit(submitRef.current) : null,
      })
    }, [autoId, group, hasSubmit])

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
          onSubmitEditing={onSubmitEditing}
          onFocus={(e) => {
            setFocusedKeyboardField(autoId)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocusedKeyboardField(null)
            onBlur?.(e)
          }}
          autoFocus={false}
          inputAccessoryViewID={accessoryId}
        />
      </>
    )
  },
)
