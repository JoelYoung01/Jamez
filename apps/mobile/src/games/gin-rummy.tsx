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
import { Keyboard, Platform, Pressable, Switch, Text, TextInput, View } from 'react-native'
import { AppTextInput } from '@/components/app-text-input'
import {
  KeyboardDismissAccessory,
  KeyboardForm,
  dismissKeyboard,
} from '@/components/keyboard-dismiss'
import { PlayerAvatar } from '@/components/player-avatar'
import { Segmented } from '@/components/segmented'
import { AppButton, Card, SectionLabel } from '@/components/ui'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

// Unique IDs per field: RN iOS drops a shared InputAccessoryView on the 2nd+
// TextInput (facebook/react-native#47865).
const LEFT_DEADWOOD_ACCESSORY_ID = 'gin-deadwood-left'
const RIGHT_DEADWOOD_ACCESSORY_ID = 'gin-deadwood-right'

function DeadwoodNav({
  canFocusLeft,
  canFocusRight,
  focused,
  onFocusLeft,
  onFocusRight,
}: {
  canFocusLeft: boolean
  canFocusRight: boolean
  focused: 'left' | 'right' | null
  onFocusLeft: () => void
  onFocusRight: () => void
}) {
  const prevDisabled = !canFocusLeft || focused === 'left'
  const nextDisabled = !canFocusRight || focused === 'right'

  return (
    <>
      <Pressable
        accessibilityLabel="Previous player"
        disabled={prevDisabled}
        hitSlop={6}
        onPress={onFocusLeft}
        className="h-10 w-10 items-center justify-center rounded-lg active:opacity-70"
      >
        <ChevronLeftIcon size={22} color={prevDisabled ? '#52525b' : '#f4f4f5'} />
      </Pressable>
      <Pressable
        accessibilityLabel="Next player"
        disabled={nextDisabled}
        hitSlop={6}
        onPress={onFocusRight}
        className="h-10 w-10 items-center justify-center rounded-lg active:opacity-70"
      >
        <ChevronRightIcon size={22} color={nextDisabled ? '#52525b' : '#f4f4f5'} />
      </Pressable>
    </>
  )
}

function DeadwoodKeyboardAccessory({
  canFocusLeft,
  canFocusRight,
  focused,
  onFocusLeft,
  onFocusRight,
}: {
  canFocusLeft: boolean
  canFocusRight: boolean
  focused: 'left' | 'right' | null
  onFocusLeft: () => void
  onFocusRight: () => void
}) {
  const navProps = {
    canFocusLeft,
    canFocusRight,
    focused,
    onFocusLeft,
    onFocusRight,
  }

  // iOS: one native bar per TextInput (shared IDs break on the second field).
  // Android has no InputAccessoryView, so show prev/next under the fields while
  // focused (the app-wide Android dismiss host still covers the keyboard itself).
  if (Platform.OS === 'ios') {
    return (
      <>
        <KeyboardDismissAccessory
          nativeID={LEFT_DEADWOOD_ACCESSORY_ID}
          leading={<DeadwoodNav {...navProps} />}
        />
        <KeyboardDismissAccessory
          nativeID={RIGHT_DEADWOOD_ACCESSORY_ID}
          leading={<DeadwoodNav {...navProps} />}
        />
      </>
    )
  }

  if (!focused) return null
  return (
    <View className="flex-row items-center gap-0.5 rounded-lg border border-line bg-card px-2 py-1.5">
      <DeadwoodNav {...navProps} />
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
  // Prefer the current user as knocker; keep null until they explicitly pick so a
  // late-arriving `me` (session resume) still wins over the p1 fallback.
  const [knockerOverride, setKnockerOverride] = React.useState<string | null>(null)
  const knockerId =
    knockerOverride && game.playerIds.includes(knockerOverride)
      ? knockerOverride
      : me && game.playerIds.includes(me.id)
        ? me.id
        : p1
  const [outcome, setOutcome] = React.useState<GinOutcome>('knock')
  // Per-player deadwood so fields stay in seat order when the knocker changes.
  const [deadwoodByPlayer, setDeadwoodByPlayer] = React.useState<Record<string, string>>({})
  const [focusedField, setFocusedField] = React.useState<'left' | 'right' | null>(null)
  const leftInputRef = React.useRef<TextInput>(null)
  const rightInputRef = React.useRef<TextInput>(null)

  const defenderId = knockerId === p1 ? p2 : p1
  const knockerEditable = outcome === 'knock'
  const knockerDeadwood = deadwoodByPlayer[knockerId] ?? ''
  const defenderDeadwood = deadwoodByPlayer[defenderId] ?? ''
  const kd = knockerEditable ? Number.parseInt(knockerDeadwood || 'NaN', 10) : 0
  const dd = Number.parseInt(defenderDeadwood || 'NaN', 10)
  const valid =
    !Number.isNaN(dd) && dd >= 0 && (!knockerEditable || (!Number.isNaN(kd) && kd >= 1 && kd <= 10))
  const leftEditable = p1 !== knockerId || knockerEditable
  const rightEditable = p2 !== knockerId || knockerEditable
  const leftAccessoryId = Platform.OS === 'ios' ? LEFT_DEADWOOD_ACCESSORY_ID : undefined
  const rightAccessoryId = Platform.OS === 'ios' ? RIGHT_DEADWOOD_ACCESSORY_ID : undefined

  React.useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => setFocusedField(null))
    return () => sub.remove()
  }, [])

  const setPlayerDeadwood = (playerId: string, value: string) => {
    setDeadwoodByPlayer((prev) => ({
      ...prev,
      [playerId]: value.replace(/[^0-9]/g, '').slice(0, 2),
    }))
  }

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
    setDeadwoodByPlayer({})
    setOutcome('knock')
  }

  const deadwoodAccessory = (
    <DeadwoodKeyboardAccessory
      canFocusLeft={leftEditable}
      canFocusRight={rightEditable}
      focused={focusedField}
      onFocusLeft={() => leftInputRef.current?.focus()}
      onFocusRight={() => rightInputRef.current?.focus()}
    />
  )

  return (
    <Card className="p-4">
      <KeyboardForm onSubmit={submit}>
        <View className="gap-3">
          {/* iOS: mount accessories before the inputs so they attach on first focus. */}
          {Platform.OS === 'ios' ? deadwoodAccessory : null}
          <Text className="text-sm font-semibold text-zinc-100">Record a hand</Text>
          <View className="gap-1.5">
            <SectionLabel>Who knocked?</SectionLabel>
            <Segmented
              value={knockerId}
              onChange={setKnockerOverride}
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
            {game.playerIds.map((id, index) => {
              const isKnocker = id === knockerId
              const editable = !isKnocker || knockerEditable
              const seat = index === 0 ? 'left' : 'right'
              const ref = seat === 'left' ? leftInputRef : rightInputRef
              const accessoryId = seat === 'left' ? leftAccessoryId : rightAccessoryId
              return (
                <View key={id} className="flex-1 gap-1.5">
                  <SectionLabel>{playerOf(id)?.name}'s deadwood</SectionLabel>
                  <AppTextInput
                    ref={ref}
                    editable={editable}
                    value={editable ? (deadwoodByPlayer[id] ?? '') : '0'}
                    onChangeText={(t) => setPlayerDeadwood(id, t)}
                    onFocus={() => setFocusedField(seat)}
                    keyboardType="number-pad"
                    inputAccessoryViewID={accessoryId}
                    placeholder={
                      isKnocker ? (knockerEditable ? '1–10' : '0 (gin!)') : 'after layoffs'
                    }
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    className={clsx(
                      'h-12 rounded-lg border border-line bg-field text-center font-mono text-lg text-zinc-100',
                      !editable && 'opacity-50',
                    )}
                  />
                </View>
              )
            })}
          </View>
          {/* Android: prev/next sit under the fields while focused. */}
          {Platform.OS !== 'ios' ? deadwoodAccessory : null}
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
        </View>
      </KeyboardForm>
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
          const isDealer = game.dealerId === id
          if (!player) return null
          return (
            <Pressable
              key={id}
              disabled={!isHost || isDealer}
              accessibilityRole={isHost ? 'button' : undefined}
              accessibilityState={isHost ? { selected: isDealer } : undefined}
              accessibilityLabel={isHost ? `Set ${player.name} as dealer` : undefined}
              onPress={isHost && !isDealer ? () => send({ type: 'setDealer', playerId: id }) : undefined}
              className="flex-1 active:opacity-80"
            >
              <Card
                className={clsx('items-center gap-1 p-4', isDealer && 'border-primary/40')}
              >
                <PlayerAvatar player={player} showPresence />
                <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                  {player.name}
                </Text>
                <Text className="font-mono text-4xl font-bold text-zinc-100">{total}</Text>
                <Text className="text-xs text-muted-foreground">
                  {boxes[id] ?? 0} {(boxes[id] ?? 0) === 1 ? 'hand' : 'hands'} won
                  {isDealer ? ' · dealing' : ''}
                </Text>
                <View className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <View className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
                </View>
              </Card>
            </Pressable>
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
