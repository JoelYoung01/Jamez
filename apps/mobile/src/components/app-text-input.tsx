import * as React from 'react'
import { Platform, TextInput, type TextInputProps } from 'react-native'
import { KeyboardDismissAccessory } from '@/components/keyboard-dismiss'

let accessorySeq = 0

/**
 * Drop-in TextInput that attaches a keyboard dismiss accessory on iOS.
 * Pass `inputAccessoryViewID` yourself to opt into a custom accessory (and
 * skip the default dismiss bar).
 */
export const AppTextInput = React.forwardRef<TextInput, TextInputProps>(
  function AppTextInput({ inputAccessoryViewID, ...props }, ref) {
    const autoId = React.useRef(`jamez-kbd-${++accessorySeq}`).current
    const useDefault = Platform.OS === 'ios' && inputAccessoryViewID == null
    const accessoryId = inputAccessoryViewID ?? (useDefault ? autoId : undefined)

    return (
      <>
        <TextInput ref={ref} {...props} inputAccessoryViewID={accessoryId} />
        {useDefault ? <KeyboardDismissAccessory nativeID={autoId} /> : null}
      </>
    )
  },
)
