import { SearchIcon, XIcon } from 'lucide-react-native'
import * as React from 'react'
import {
  Animated,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppTextInput } from '@/components/app-text-input'
import { useKeyboardHeight } from '@/lib/keyboard'

const FAB_SIZE = 56
const BAR_HEIGHT = 52
const H_PAD = 16
const KEYBOARD_GAP = 10

type FloatingSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchLabel?: string
  /** When false, the control is not rendered. Default true. */
  visible?: boolean
  /** Reports bottom padding the page list should reserve. */
  onBottomPadChange?: (pad: number) => void
}

/**
 * Collapsible FAB → search bar — same pattern as Browse the shelf.
 */
export function FloatingSearch({
  value,
  onChange,
  placeholder = 'Filter',
  searchLabel = 'Search',
  visible = true,
  onBottomPadChange,
}: FloatingSearchProps) {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()
  const inputRef = React.useRef<TextInput>(null)
  const [expanded, setExpanded] = React.useState(false)
  const progress = React.useRef(new Animated.Value(0)).current

  const screenWidth = Dimensions.get('window').width
  const fullWidth = screenWidth - H_PAD * 2
  const keyboardOpen = keyboardHeight > 0
  const bottomOffset =
    Platform.OS === 'ios' && keyboardOpen
      ? keyboardHeight + KEYBOARD_GAP
      : Math.max(insets.bottom, 12) + (expanded && !keyboardOpen ? 8 : 4)

  React.useEffect(() => {
    if (!visible) {
      onBottomPadChange?.(32)
      return
    }
    const pad =
      (expanded ? BAR_HEIGHT + 24 : FAB_SIZE + 28) +
      (Platform.OS === 'ios' && keyboardOpen
        ? keyboardHeight + KEYBOARD_GAP
        : Math.max(insets.bottom, 8))
    onBottomPadChange?.(pad)
  }, [
    visible,
    expanded,
    keyboardOpen,
    keyboardHeight,
    insets.bottom,
    onBottomPadChange,
  ])

  const expand = () => {
    setExpanded(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: false,
      speed: 18,
      bounciness: 6,
    }).start()
  }

  const collapse = React.useCallback(() => {
    Keyboard.dismiss()
    Animated.spring(progress, {
      toValue: 0,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    }).start(({ finished }) => {
      if (finished) {
        setExpanded(false)
        onChange('')
      }
    })
  }, [onChange, progress])

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [FAB_SIZE, fullWidth],
  })
  const height = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [FAB_SIZE, BAR_HEIGHT],
  })
  const radius = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [FAB_SIZE / 2, 16],
  })
  const iconOpacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [1, 0, 0],
  })
  const fieldOpacity = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0, 1],
  })
  const fabBgOpacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  })
  const barBgOpacity = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 1, 1],
  })

  if (!visible) return null

  return (
    <Animated.View
      style={{
        position: 'absolute',
        right: H_PAD,
        bottom: bottomOffset,
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: '#fbbf24',
          opacity: fabBgOpacity,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(24, 24, 27, 0.96)',
          borderWidth: 1,
          borderColor: '#2a2a32',
          borderRadius: 16,
          opacity: barBgOpacity,
        }}
      />

      <Animated.View
        pointerEvents={expanded ? 'none' : 'auto'}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: iconOpacity,
        }}
      >
        <Pressable
          onPress={expand}
          accessibilityRole="button"
          accessibilityLabel={searchLabel}
          className="h-full w-full items-center justify-center active:opacity-80"
        >
          <SearchIcon size={22} color="#251a02" />
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          opacity: fieldOpacity,
        }}
      >
        <SearchIcon size={18} color="#a1a1ab" />
        <AppTextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.25)"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          keyboardAccessory={false}
          onSubmitEditing={() => Keyboard.dismiss()}
          className="h-11 flex-1 text-base text-zinc-100"
        />
        <Pressable
          onPress={collapse}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close search"
          className="h-8 w-8 items-center justify-center rounded-lg bg-muted active:opacity-70"
        >
          <XIcon size={16} color="#f4f4f5" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}
