import { clsx } from 'clsx'
import { CheckIcon, ChevronDownIcon } from 'lucide-react-native'
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

const DEFAULT_GROUP = '__default__'

type FieldRecord = {
  id: string
  input: TextInput
  group: string
  order: number
  /** Field-level submit (usually the input's onSubmitEditing handler). */
  submit: (() => void) | null
}

type GroupRecord = {
  onSubmit?: () => void
}

let orderSeq = 0
const fields = new Map<string, FieldRecord>()
const groups = new Map<string, GroupRecord>()
let focusedFieldId: string | null = null
/** Survives blur-before-press when tapping the Android floating host. */
let lastFocusedFieldId: string | null = null
let androidHostSuppress = 0
const androidHostListeners = new Set<() => void>()

function notifyAndroidHost() {
  for (const listener of androidHostListeners) listener()
}

/** Blur the focused field and hide the keyboard. */
export function dismissKeyboard() {
  const focused = TextInput.State.currentlyFocusedInput()
  if (focused) focused.blur()
  Keyboard.dismiss()
  focusedFieldId = null
  lastFocusedFieldId = null
}

function fieldsInGroup(group: string): FieldRecord[] {
  return [...fields.values()]
    .filter((f) => f.group === group)
    .sort((a, b) => a.order - b.order)
}

export function setFocusedKeyboardField(id: string | null) {
  if (id) {
    focusedFieldId = id
    lastFocusedFieldId = id
  } else {
    focusedFieldId = null
  }
}

/**
 * Advance to the next registered field in the active group, or submit when on
 * the last (or only) field: field submit handler, else group onSubmit, then dismiss.
 */
export function advanceOrSubmitKeyboard(): void {
  const id = focusedFieldId ?? lastFocusedFieldId
  const current = id ? fields.get(id) : undefined
  if (!current) {
    dismissKeyboard()
    return
  }

  const list = fieldsInGroup(current.group)
  const idx = list.findIndex((f) => f.id === current.id)

  if (idx >= 0 && idx < list.length - 1) {
    list[idx + 1]!.input.focus()
    return
  }

  try {
    if (current.submit) current.submit()
    else groups.get(current.group)?.onSubmit?.()
  } catch {
    // ignore submit errors from callers
  }
  dismissKeyboard()
}

export function registerKeyboardField(opts: {
  id: string
  input: TextInput | null
  group?: string
  submit?: (() => void) | null
}): () => void {
  const { id, input, group = DEFAULT_GROUP, submit = null } = opts
  if (!input) {
    fields.delete(id)
    if (focusedFieldId === id) focusedFieldId = null
    return () => {
      fields.delete(id)
      if (focusedFieldId === id) focusedFieldId = null
    }
  }
  const existing = fields.get(id)
  fields.set(id, {
    id,
    input,
    group,
    order: existing?.order ?? ++orderSeq,
    submit,
  })
  return () => {
    fields.delete(id)
    if (focusedFieldId === id) focusedFieldId = null
  }
}

export function registerKeyboardGroup(id: string, opts: GroupRecord): () => void {
  groups.set(id, opts)
  return () => {
    groups.delete(id)
  }
}

/** While mounted, hide the app-wide Android keyboard host (use local chrome instead). */
export function useSuppressAndroidKeyboardHost() {
  React.useEffect(() => {
    androidHostSuppress += 1
    notifyAndroidHost()
    return () => {
      androidHostSuppress -= 1
      notifyAndroidHost()
    }
  }, [])
}

const KeyboardFormContext = React.createContext<string>(DEFAULT_GROUP)

/** Isolate fields into a group and optionally submit when the last field checks. */
export function KeyboardForm({
  onSubmit,
  children,
}: {
  onSubmit?: () => void
  children: React.ReactNode
}) {
  const id = React.useId()
  React.useEffect(() => registerKeyboardGroup(id, { onSubmit }), [id, onSubmit])
  return <KeyboardFormContext.Provider value={id}>{children}</KeyboardFormContext.Provider>
}

export function useKeyboardFormGroup(): string {
  return React.useContext(KeyboardFormContext)
}

/** Dedicated dismiss control (chevron). */
export function KeyboardDismissButton({ floating = false }: { floating?: boolean }) {
  return (
    <Pressable
      accessibilityLabel="Dismiss keyboard"
      hitSlop={6}
      onPress={dismissKeyboard}
      className={clsx(
        'h-10 w-10 items-center justify-center active:opacity-70',
        floating ? 'rounded-full bg-card/95' : 'rounded-lg',
      )}
    >
      <ChevronDownIcon size={22} color="#a1a1ab" />
    </Pressable>
  )
}

/** Check = next field or submit. */
export function KeyboardAdvanceButton({ floating = false }: { floating?: boolean }) {
  return (
    <Pressable
      accessibilityLabel="Next field or submit"
      hitSlop={6}
      onPress={advanceOrSubmitKeyboard}
      className={clsx(
        'h-10 w-10 items-center justify-center active:opacity-70',
        floating ? 'rounded-full bg-card/95' : 'rounded-lg',
      )}
    >
      <CheckIcon size={22} color="#fbbf24" />
    </Pressable>
  )
}

/** Check + dismiss cluster used above the keyboard. */
export function KeyboardActionButtons({ floating = false }: { floating?: boolean }) {
  if (floating) {
    return (
      <View className="flex-row items-center gap-1.5">
        <KeyboardAdvanceButton floating />
        <KeyboardDismissButton floating />
      </View>
    )
  }
  return (
    <View className="flex-row items-center">
      <KeyboardAdvanceButton />
      <KeyboardDismissButton />
    </View>
  )
}

/**
 * Keyboard accessory chrome.
 * With leading controls → full-width bar.
 * Actions-only → floating check + dismiss (no full-width background).
 */
export function KeyboardDismissBar({
  leading,
  className,
}: {
  leading?: React.ReactNode
  className?: string
}) {
  if (leading == null) {
    return (
      <View
        pointerEvents="box-none"
        className={clsx('flex-row items-center justify-end bg-transparent px-2 py-1.5', className)}
      >
        <KeyboardActionButtons floating />
      </View>
    )
  }

  return (
    <View
      className={clsx(
        'flex-row items-center justify-between bg-card px-2 py-1.5',
        className,
      )}
    >
      <View className="flex-row items-center gap-0.5">{leading}</View>
      <KeyboardActionButtons />
    </View>
  )
}

/** iOS accessory view wired to a stable nativeID. */
export function KeyboardDismissAccessory({
  nativeID,
  leading,
}: {
  nativeID: string
  leading?: React.ReactNode
}) {
  if (Platform.OS !== 'ios') return null
  const dismissOnly = leading == null
  return (
    <InputAccessoryView
      nativeID={nativeID}
      backgroundColor={dismissOnly ? 'transparent' : '#17171d'}
    >
      <KeyboardDismissBar
        leading={leading}
        className={dismissOnly ? undefined : 'border-t border-line'}
      />
    </InputAccessoryView>
  )
}

/**
 * Android has no InputAccessoryView. With `softwareKeyboardLayoutMode: 'resize'`
 * the window already sits above the keyboard, so pin floating actions to the
 * bottom of that resized window.
 */
export function AndroidKeyboardDismissHost() {
  const keyboardHeight = useKeyboardHeight()
  const suppressed = React.useSyncExternalStore(
    (onStoreChange) => {
      androidHostListeners.add(onStoreChange)
      return () => {
        androidHostListeners.delete(onStoreChange)
      }
    },
    () => androidHostSuppress > 0,
    () => false,
  )

  if (Platform.OS === 'ios' || keyboardHeight <= 0 || suppressed) return null

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1000 }}
    >
      <KeyboardDismissBar />
    </View>
  )
}
