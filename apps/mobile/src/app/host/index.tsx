import { gameEngines } from '@jamez/core'
import { router } from 'expo-router'
import { ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react-native'
import * as React from 'react'
import {
  Animated,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppTextInput } from '@/components/app-text-input'
import { PageHeader } from '@/components/page-header'
import { RequireProfile } from '@/components/require-profile'
import { Card, Muted } from '@/components/ui'
import { getGameIcon } from '@/games/registry'
import { useKeyboardHeight } from '@/lib/keyboard'

const FAB_SIZE = 56
const BAR_HEIGHT = 52
const H_PAD = 16

function gameMatchesFilter(
  game: (typeof gameEngines)[number],
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    game.name.toLowerCase().includes(q) ||
    game.tagline.toLowerCase().includes(q) ||
    game.id.toLowerCase().includes(q)
  )
}

export default function HostScreen() {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()
  const inputRef = React.useRef<TextInput>(null)
  const [filter, setFilter] = React.useState('')
  const [expanded, setExpanded] = React.useState(false)
  const progress = React.useRef(new Animated.Value(0)).current

  const screenWidth = Dimensions.get('window').width
  const fullWidth = screenWidth - H_PAD * 2
  const keyboardOpen = keyboardHeight > 0
  // iOS overlays the keyboard; pin the bar to its top. Android adjustResize
  // already shrinks the window, so bottom: 0 sits above the keyboard.
  const bottomOffset =
    Platform.OS === 'ios' && keyboardOpen
      ? keyboardHeight
      : Math.max(insets.bottom, 12) + (expanded && !keyboardOpen ? 8 : 4)

  const filtered = gameEngines.filter((game) => gameMatchesFilter(game, filter))

  const expand = () => {
    setExpanded(true)
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: false,
      speed: 18,
      bounciness: 6,
    }).start()
    requestAnimationFrame(() => {
      setTimeout(() => inputRef.current?.focus(), 120)
    })
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
        setFilter('')
      }
    })
  }, [progress])

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

  const listBottomPad =
    (expanded ? BAR_HEIGHT + 24 : FAB_SIZE + 28) +
    (Platform.OS === 'ios' && keyboardOpen ? keyboardHeight : Math.max(insets.bottom, 8))

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: H_PAD,
          paddingBottom: listBottomPad,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View className="w-full max-w-xl gap-3 self-center">
          <PageHeader title="Browse the shelf" />
          <RequireProfile>
            <View className="gap-3">
              {filtered.length === 0 ? (
                <Card className="items-center px-6 py-10">
                  <Muted className="text-center">No games match “{filter.trim()}”.</Muted>
                </Card>
              ) : (
                filtered.map((game) => {
                  const Icon = getGameIcon(game.id)
                  return (
                    <Pressable
                      key={game.id}
                      onPress={() => router.push(`/host/${game.id}`)}
                      className="active:opacity-80"
                    >
                      <Card className="flex-row items-center gap-4 p-4">
                        <View
                          className="h-12 w-12 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${game.accentColor}1f` }}
                        >
                          <Icon size={24} color={game.accentColor} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="font-semibold text-zinc-100">{game.name}</Text>
                          <Muted className="text-sm">{game.tagline}</Muted>
                          <Muted className="mt-0.5">
                            {game.minPlayers === game.maxPlayers
                              ? `${game.maxPlayers} players`
                              : `${game.minPlayers}–${game.maxPlayers} players`}
                          </Muted>
                        </View>
                        <ChevronRightIcon size={16} color="#a1a1ab" />
                      </Card>
                    </Pressable>
                  )
                })
              )}
            </View>
          </RequireProfile>
        </View>
      </ScrollView>

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
            accessibilityLabel="Search games"
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
            value={filter}
            onChangeText={setFilter}
            placeholder="Filter games"
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
    </View>
  )
}
