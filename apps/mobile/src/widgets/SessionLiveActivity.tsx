import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import {
  clipShape,
  font,
  foregroundStyle,
  frame,
  padding,
  resizable,
} from '@expo/ui/swift-ui/modifiers'
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets'

/**
 * Props for the session Live Activity (Lock Screen card + Dynamic Island).
 * Must stay JSON-serializable — the widget runtime only receives this object.
 */
export type SessionLiveProps = {
  gameName: string
  code: string
  /** lobby | playing | finished */
  phase: string
  /** host | guest */
  role: string
  /** e.g. "Lobby · 3 players" or summary headline */
  statusLine: string
  /** Compact Dynamic Island trailing text */
  trailing: string
  /** Up to 4 short standing lines for the expanded island */
  lines: string[]
  accentColor: string
  /**
   * `file://` URI of the app icon in the shared widgets directory.
   * Empty when unavailable — falls back to an SF Symbol.
   */
  iconUri: string
}

/**
 * Layout helpers must live inside this function: the `'widget'` directive
 * serializes only the function body into the widget extension's JS runtime.
 */
const SessionLiveActivityLayout = (props: SessionLiveProps, _env: LiveActivityEnvironment) => {
  'widget'
  const accent = props.accentColor || '#fbbf24'
  const phaseLabel =
    props.phase === 'finished' ? 'Finished' : props.phase === 'lobby' ? 'Lobby' : 'Live'
  const roleLabel = props.role === 'host' ? 'Hosting' : 'Joined'
  const symbol =
    props.phase === 'finished' ? 'trophy.fill' : props.phase === 'lobby' ? 'qrcode' : 'dice.fill'
  const iconUri = props.iconUri || ''
  const standingLines = (props.lines ?? []).slice(0, 4)

  const appIcon = (size: number) =>
    iconUri ? (
      <Image
        uiImage={iconUri}
        modifiers={[
          resizable(),
          frame({ width: size, height: size }),
          clipShape('roundedRectangle', Math.round(size * 0.22)),
        ]}
      />
    ) : (
      <Image systemName={symbol} color={accent} size={Math.round(size * 0.55)} />
    )

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <HStack spacing={10} alignment="center">
          {appIcon(36)}
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle('#F4F4F5')]}>
              {props.gameName}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle('#A1A1AB')]}>
              {roleLabel} · {phaseLabel}
            </Text>
          </VStack>
          <Spacer />
          <Text modifiers={[font({ weight: 'bold', size: 22 }), foregroundStyle(accent)]}>
            {props.code}
          </Text>
        </HStack>
      </VStack>
    ),
    compactLeading: appIcon(16),
    compactTrailing: (
      <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(accent)]}>
        {props.code}
      </Text>
    ),
    minimal: appIcon(14),
    expandedLeading: (
      <VStack spacing={4} modifiers={[padding({ all: 10 })]}>
        {appIcon(28)}
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#A1A1AB')]}>{roleLabel}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle(accent)]}>
          {props.code}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#A1A1AB')]}>{phaseLabel}</Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#F4F4F5')]}>
          {props.gameName}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle('#A1A1AB')]}>
          {roleLabel} · {phaseLabel}
        </Text>
        {standingLines.map((line, index) => (
          <Text key={index} modifiers={[font({ size: 12 }), foregroundStyle('#A1A1AB')]}>
            {line}
          </Text>
        ))}
      </VStack>
    ),
  }
}

export default createLiveActivity<SessionLiveProps>('SessionLiveActivity', SessionLiveActivityLayout)
