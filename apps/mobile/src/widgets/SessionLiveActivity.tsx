import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers'
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
  /** Up to 4 short standing lines for the banner / expanded island */
  lines: string[]
  accentColor: string
}

/**
 * Layout helpers must live inside this function: the `'widget'` directive
 * serializes only the function body into the widget extension's JS runtime.
 */
const SessionLiveActivityLayout = (props: SessionLiveProps, _env: LiveActivityEnvironment) => {
  'widget'
  const accent = props.accentColor || '#fbbf24'
  const phaseLabel =
    props.phase === 'lobby' ? 'Lobby' : props.phase === 'finished' ? 'Finished' : 'Live'
  const roleLabel = props.role === 'host' ? 'Hosting' : 'Joined'
  const symbol =
    props.phase === 'finished' ? 'trophy.fill' : props.phase === 'lobby' ? 'qrcode' : 'dice.fill'

  const standingLines = (props.lines ?? []).slice(0, 4)

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <HStack>
          <Image systemName={symbol} color={accent} size={18} />
          <VStack>
            <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle('#F4F4F5')]}>
              {props.gameName}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle('#A1A1AB')]}>
              {roleLabel} · {phaseLabel} · {props.code}
            </Text>
          </VStack>
          <Spacer />
          <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(accent)]}>
            {props.trailing}
          </Text>
        </HStack>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#E4E4E7')]}>{props.statusLine}</Text>
        {standingLines.map((line, index) => (
          <Text key={index} modifiers={[font({ size: 12 }), foregroundStyle('#A1A1AB')]}>
            {line}
          </Text>
        ))}
      </VStack>
    ),
    compactLeading: <Image systemName={symbol} color={accent} size={16} />,
    compactTrailing: (
      <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle(accent)]}>
        {props.trailing}
      </Text>
    ),
    minimal: <Image systemName={symbol} color={accent} size={14} />,
    expandedLeading: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Image systemName={symbol} color={accent} size={22} />
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#A1A1AB')]}>{roleLabel}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(accent)]}>
          {props.code}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#A1A1AB')]}>{phaseLabel}</Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle('#F4F4F5')]}>
          {props.gameName}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle('#E4E4E7')]}>{props.statusLine}</Text>
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
