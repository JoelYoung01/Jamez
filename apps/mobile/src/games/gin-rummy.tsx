import {
  ginBoxes,
  ginFinalTally,
  ginTotals,
  scoreGinHand,
  type GinConfig,
  type GinOutcome,
  type GinState,
  type SessionState,
} from '@jamez/core'
import { clsx } from 'clsx'
import { ChevronLeftIcon, ChevronRightIcon, Undo2Icon, WalletCardsIcon, ZapIcon } from 'lucide-react-native'
import * as React from 'react'
import {
  Keyboard,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { AppTextInput } from '@/components/app-text-input'
import {
  KeyboardDismissAccessory,
  dismissKeyboard,
} from '@/components/keyboard-dismiss'
import { PlayerAvatar } from '@/components/player-avatar'
import { Segmented } from '@/components/segmented'
import { AppButton, Card, SectionLabel } from '@/components/ui'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

const DEADWOOD_ACCESSORY_ID = 'gin-deadwood-accessory'

function DeadwoodNav({
  canFocusKnocker,
  focused,
  onFocusKnocker,
  onFocusDefender,
}: {
  canFocusKnocker: boolean
  focused: 'knocker' | 'defender' | null
  onFocusKnocker: () => void
  onFocusDefender: () => void
}) {
  const prevDisabled = !canFocusKnocker || focused === 'knocker'
  const nextDisabled = focused === 'defender'

  return (
    <>
      <Pressable
        accessibilityLabel="Previous player"
        disabled={prevDisabled}
        hitSlop={6}
        onPress={onFocusKnocker}
        className="h-10 w-10 items-center justify-center rounded-lg active:opacity-70"
      >
        <ChevronLeftIcon size={22} color={prevDisabled ? '#52525b' : '#f4f4f5'} />
      </Pressable>
      <Pressable
        accessibilityLabel="Next player"
        disabled={nextDisabled}
        hitSlop={6}
        onPress={onFocusDefender}
        className="h-10 w-10 items-center justify-center rounded-lg active:opacity-70"
      >
        <ChevronRightIcon size={22} color={nextDisabled ? '#52525b' : '#f4f4f5'} />
      </Pressable>
    </>
  )
}

function DeadwoodKeyboardAccessory({
  canFocusKnocker,
  focused,
  onFocusKnocker,
  onFocusDefender,
}: {
  canFocusKnocker: boolean
  focused: 'knocker' | 'defender' | null
  onFocusKnocker: () => void
  onFocusDefender: () => void
}) {
  const leading = (
    <DeadwoodNav
      canFocusKnocker={canFocusKnocker}
      focused={focused}
      onFocusKnocker={onFocusKnocker}
      onFocusDefender={onFocusDefender}
    />
  )

  // iOS: native bar pinned above the keyboard. Android has no InputAccessoryView,
  // so show the same controls under the fields while a deadwood input is focused
  // (the app-wide Android dismiss host still covers the keyboard itself).
  if (Platform.OS === 'ios') {
    return <KeyboardDismissAccessory nativeID={DEADWOOD_ACCESSORY_ID} leading={leading} />
  }

  if (!focused) return null
  // Dismiss lives on the app-wide Android keyboard host; keep prev/next near the fields.
  return (
    <View className="flex-row items-center gap-0.5 rounded-lg border border-line bg-card px-2 py-1.5">
      {leading}
    </View>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <View className="flex-1 gap-1.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <AppTextInput
        value={String(value)}
        keyboardType="number-pad"
        onChangeText={(t) => {
          const parsed = Number.parseInt(t.replace(/[^0-9]/g, ''), 10)
          onChange(Number.isNaN(parsed) ? 0 : Math.min(1000, parsed))
        }}
        className="h-10 rounded-lg border border-line bg-field px-3 text-center font-mono text-base text-zinc-100"
      />
    </View>
  )
}

function GinSetup({ config, onChange }: GameSetupProps<GinConfig>) {
  const patch = (p: Partial<GinConfig>) => onChange({ ...config, ...p })
  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <NumberField label="Play to" value={config.targetScore} onChange={(v) => patch({ targetScore: v })} />
        <NumberField label="Line / box bonus" value={config.lineBonus} onChange={(v) => patch({ lineBonus: v })} />
      </View>
      <View className="flex-row gap-3">
        <NumberField label="Gin bonus" value={config.ginBonus} onChange={(v) => patch({ ginBonus: v })} />
        <NumberField label="Big gin" value={config.bigGinBonus} onChange={(v) => patch({ bigGinBonus: v })} />
        <NumberField label="Undercut" value={config.undercutBonus} onChange={(v) => patch({ undercutBonus: v })} />
      </View>
      <View className="flex-row items-end gap-3">
        <NumberField label="Game bonus" value={config.gameBonus} onChange={(v) => patch({ gameBonus: v })} />
        <View className="flex-1 flex-row items-center justify-between rounded-lg border border-line px-3 py-2.5">
          <Text className="text-xs text-muted-foreground">Shutout doubles it</Text>
          <Switch
            value={config.shutoutDoublesGameBonus}
            onValueChange={(v) => patch({ shutoutDoublesGameBonus: v })}
            trackColor={{ true: '#fbbf24' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>
    </View>
  )
}

function RecordHandForm({ state: session, me, isHost, send }: GamePlayProps) {
  const game = session.game as GinState
  const [p1, p2] = game.playerIds
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const [knockerId, setKnockerId] = React.useState(me && game.playerIds.includes(me.id) ? me.id : p1)
  const [outcome, setOutcome] = React.useState<GinOutcome>('knock')
  const [knockerDeadwood, setKnockerDeadwood] = React.useState('')
  const [defenderDeadwood, setDefenderDeadwood] = React.useState('')
  const [focusedField, setFocusedField] = React.useState<'knocker' | 'defender' | null>(null)
  const knockerInputRef = React.useRef<TextInput>(null)
  const defenderInputRef = React.useRef<TextInput>(null)

  const defenderId = knockerId === p1 ? p2 : p1
  const knockerEditable = outcome === 'knock'
  const kd = knockerEditable ? Number.parseInt(knockerDeadwood || 'NaN', 10) : 0
  const dd = Number.parseInt(defenderDeadwood || 'NaN', 10)
  const valid =
    !Number.isNaN(dd) && dd >= 0 && (!knockerEditable || (!Number.isNaN(kd) && kd >= 1 && kd <= 10))
  const accessoryViewID = Platform.OS === 'ios' ? DEADWOOD_ACCESSORY_ID : undefined

  React.useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => setFocusedField(null))
    return () => sub.remove()
  }, [])

  const preview = valid
    ? scoreGinHand(game.config, {
        knockerId,
        defenderId,
        outcome,
        knockerDeadwood: kd,
        defenderDeadwood: dd,
      })
    : null

  const submit = () => {
    if (!valid) return
    dismissKeyboard()
    send({ type: 'recordHand', knockerId, outcome, knockerDeadwood: kd, defenderDeadwood: dd })
    setKnockerDeadwood('')
    setDefenderDeadwood('')
    setOutcome('knock')
  }

  return (
    <Card className="gap-3 p-4">
      <Text className="text-sm font-semibold text-zinc-100">Record a hand</Text>
      <View className="gap-1.5">
        <SectionLabel>Who knocked?</SectionLabel>
        <Segmented
          value={knockerId}
          onChange={setKnockerId}
          options={game.playerIds.map((id) => ({
            value: id,
            label: `${playerOf(id)?.emoji ?? ''} ${playerOf(id)?.name ?? '?'}`,
          }))}
        />
      </View>
      <View className="gap-1.5">
        <SectionLabel>Result</SectionLabel>
        <Segmented
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: 'knock', label: 'Knock' },
            { value: 'gin', label: 'Gin' },
            { value: 'bigGin', label: 'Big gin' },
          ]}
        />
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1.5">
          <SectionLabel>{playerOf(knockerId)?.name}'s deadwood</SectionLabel>
          <TextInput
            ref={knockerInputRef}
            editable={knockerEditable}
            value={knockerEditable ? knockerDeadwood : '0'}
            onChangeText={(t) => setKnockerDeadwood(t.replace(/[^0-9]/g, '').slice(0, 2))}
            onFocus={() => setFocusedField('knocker')}
            keyboardType="number-pad"
            inputAccessoryViewID={accessoryViewID}
            placeholder={knockerEditable ? '1–10' : '0 (gin!)'}
            placeholderTextColor="rgba(255,255,255,0.2)"
            className={clsx(
              'h-12 rounded-lg border border-line bg-field text-center font-mono text-lg text-zinc-100',
              !knockerEditable && 'opacity-50',
            )}
          />
        </View>
        <View className="flex-1 gap-1.5">
          <SectionLabel>{playerOf(defenderId)?.name}'s deadwood</SectionLabel>
          <TextInput
            ref={defenderInputRef}
            value={defenderDeadwood}
            onChangeText={(t) => setDefenderDeadwood(t.replace(/[^0-9]/g, '').slice(0, 2))}
            onFocus={() => setFocusedField('defender')}
            keyboardType="number-pad"
            inputAccessoryViewID={accessoryViewID}
            placeholder="after layoffs"
            placeholderTextColor="rgba(255,255,255,0.2)"
            className="h-12 rounded-lg border border-line bg-field text-center font-mono text-lg text-zinc-100"
          />
        </View>
      </View>
      <DeadwoodKeyboardAccessory
        canFocusKnocker={knockerEditable}
        focused={focusedField}
        onFocusKnocker={() => knockerInputRef.current?.focus()}
        onFocusDefender={() => defenderInputRef.current?.focus()}
      />
      {preview && (
        <View
          className={clsx(
            'flex-row items-center justify-center gap-1 rounded-lg px-3 py-2',
            preview.undercut ? 'bg-destructive/10' : 'bg-emerald-400/10',
          )}
        >
          {preview.undercut && <ZapIcon size={14} color="#f87171" />}
          <Text
            className={clsx(
              'text-center text-sm font-medium',
              preview.undercut ? 'text-destructive' : 'text-emerald-300',
            )}
          >
            {preview.undercut ? 'Undercut! ' : ''}
            {playerOf(preview.winnerId)?.name} scores +{preview.points}
          </Text>
        </View>
      )}
      <AppButton title="Add hand" disabled={!valid} onPress={submit} />
      {!isHost && (
        <Text className="text-center text-xs text-muted-foreground">
          The host confirms every entry. Mistakes can be undone on the host device.
        </Text>
      )}
    </Card>
  )
}

function GinPlay(props: GamePlayProps) {
  const { state: session, isHost, send } = props
  const game = session.game as GinState
  const totals = ginTotals(game)
  const boxes = ginBoxes(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)

  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        {game.playerIds.map((id) => {
          const player = playerOf(id)
          const total = totals[id] ?? 0
          const progress = Math.min(1, total / game.config.targetScore)
          if (!player) return null
          return (
            <Card
              key={id}
              className={clsx('flex-1 items-center gap-1 p-4', game.dealerId === id && 'border-primary/40')}
            >
              <PlayerAvatar player={player} showPresence />
              <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                {player.name}
              </Text>
              <Text className="font-mono text-4xl font-bold text-zinc-100">{total}</Text>
              <Text className="text-xs text-muted-foreground">
                {boxes[id] ?? 0} {(boxes[id] ?? 0) === 1 ? 'hand' : 'hands'} won
                {game.dealerId === id ? ' · dealing' : ''}
              </Text>
              <View className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <View className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
              </View>
            </Card>
          )
        })}
      </View>
      <Text className="text-center text-xs text-muted-foreground">
        First to {game.config.targetScore} wins the match
      </Text>

      <RecordHandForm {...props} />

      {game.hands.length > 0 && (
        <Card className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-zinc-100">Hands</Text>
            {isHost && (
              <Pressable
                onPress={() => send({ type: 'undoHand' })}
                className="flex-row items-center gap-1 active:opacity-70"
              >
                <Undo2Icon size={14} color="#a1a1ab" />
                <Text className="text-sm text-muted-foreground">Undo last</Text>
              </Pressable>
            )}
          </View>
          {[...game.hands].reverse().map((hand) => {
            const winner = playerOf(hand.winnerId)
            const knocker = playerOf(hand.knockerId)
            const description =
              hand.outcome === 'gin'
                ? `${knocker?.name} went gin (${hand.defenderDeadwood} caught)`
                : hand.outcome === 'bigGin'
                  ? `${knocker?.name} went BIG gin!`
                  : hand.undercut
                    ? `${winner?.name} undercut ${knocker?.name} (${hand.defenderDeadwood} vs ${hand.knockerDeadwood})`
                    : `${knocker?.name} knocked with ${hand.knockerDeadwood} vs ${hand.defenderDeadwood}`
            return (
              <View
                key={hand.n}
                className="flex-row items-center gap-2.5 rounded-lg border border-line bg-field px-3 py-2"
              >
                <Text className="w-6 text-center font-mono text-xs text-muted-foreground">#{hand.n}</Text>
                <Text>{winner?.emoji}</Text>
                <Text
                  className={clsx('flex-1 text-sm', hand.undercut ? 'text-destructive' : 'text-zinc-200')}
                  numberOfLines={1}
                >
                  {description}
                </Text>
                <Text className="font-mono text-sm font-semibold text-emerald-300">+{hand.points}</Text>
              </View>
            )
          })}
        </Card>
      )}
    </View>
  )
}

function GinResults({ state: session }: { state: SessionState }) {
  const game = session.game as GinState
  const tally = ginFinalTally(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  return (
    <Card className="gap-3 p-4">
      <Text className="text-sm font-semibold text-zinc-100">Final tally</Text>
      {tally.map((line) => {
        const player = playerOf(line.playerId)
        return (
          <View key={line.playerId} className="rounded-xl border border-line p-3">
            <View className="flex-row items-center gap-2">
              <Text>{player?.emoji}</Text>
              <Text className="flex-1 text-sm font-medium text-zinc-100">{player?.name}</Text>
              <Text className="font-mono text-xl font-bold text-primary">{line.finalScore}</Text>
            </View>
            <View className="mt-1.5 gap-0.5 pl-7">
              <Text className="font-mono text-xs text-muted-foreground">hand points: {line.handPoints}</Text>
              <Text className="font-mono text-xs text-muted-foreground">
                boxes: {line.boxes} × {game.config.lineBonus} = {line.lineBonusTotal}
              </Text>
              {line.gameBonus > 0 && (
                <Text className="font-mono text-xs text-muted-foreground">game bonus: +{line.gameBonus}</Text>
              )}
            </View>
          </View>
        )
      })}
      <Text className="text-center text-xs text-muted-foreground">
        {game.hands.length} {game.hands.length === 1 ? 'hand' : 'hands'} played
      </Text>
    </Card>
  )
}

export const ginRummyUI: GameUIModule = {
  id: 'gin-rummy',
  icon: WalletCardsIcon,
  SetupForm: GinSetup as GameUIModule['SetupForm'],
  PlayView: GinPlay,
  ResultsDetail: GinResults,
  configSummary: (config) => {
    const c = config as GinConfig
    return [`First to ${c.targetScore}`, `Gin +${c.ginBonus}`, `Boxes ${c.lineBonus}`]
  },
}
