import {
  chipBreakdown,
  formatPokerAmount,
  pointsFromChipCounts,
  toPoints,
  type PokerBankConfig,
  type PokerBankState,
  type PokerChipDenom,
  type PokerCurrencyMode,
  type SessionPlayer,
} from '@jamez/core'
import { CoinsIcon, DollarSignIcon, MinusIcon, PlusIcon, Settings2Icon } from 'lucide-react-native'
import * as React from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { AppTextInput } from '@/components/app-text-input'
import { ColorPicker } from '@/components/color-picker'
import { EmojiGrid } from '@/components/emoji-grid'
import {
  KeyboardActionButtons,
  KeyboardForm,
  useSuppressAndroidKeyboardHost,
} from '@/components/keyboard-dismiss'
import { PokerChip } from '@/components/poker-chip'
import { PlayerAvatar } from '@/components/player-avatar'
import { Segmented } from '@/components/segmented'
import { AppButton, Card, CardTitle, Chip, Muted, SectionLabel } from '@/components/ui'
import { useKeyboardHeight } from '@/lib/keyboard'
import { randomEmoji } from '@/lib/profile'
import { useSession } from '@/lib/session-store'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

/** Allow typing partial decimals (e.g. clear → "0.25"); coerce on blur. */
function parsePointsPerDollar(raw: string): number {
  const n = Number.parseFloat(raw.trim())
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.min(1_000_000, n)
}

function PointsPerDollarField({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (next: number) => void
  className?: string
}) {
  const [text, setText] = React.useState(String(value))

  React.useEffect(() => {
    setText(String(value))
  }, [value])

  const commit = () => {
    const next = parsePointsPerDollar(text)
    onChange(next)
    setText(String(next))
  }

  return (
    <AppTextInput
      keyboardType="decimal-pad"
      value={text}
      onChangeText={(t) => {
        setText(t)
        const n = Number.parseFloat(t.trim())
        if (Number.isFinite(n) && n > 0) onChange(Math.min(1_000_000, n))
      }}
      onBlur={commit}
      onSubmitEditing={commit}
      className={
        className ?? 'h-11 rounded-xl border border-line bg-background px-3 font-mono text-zinc-100'
      }
    />
  )
}

/** Integer chip value — draft while typing; coerce to ≥1 on blur. */
function ChipValueField({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (next: number) => void
  className?: string
}) {
  const [text, setText] = React.useState(String(value))

  React.useEffect(() => {
    setText(String(value))
  }, [value])

  const commit = () => {
    const n = Number.parseInt(text.replace(/\D/g, ''), 10)
    const next = Number.isNaN(n) ? 1 : Math.max(1, n)
    onChange(next)
    setText(String(next))
  }

  return (
    <AppTextInput
      keyboardType="number-pad"
      value={text}
      onChangeText={(t) => {
        const cleaned = t.replace(/\D/g, '')
        setText(cleaned)
        const n = Number.parseInt(cleaned, 10)
        if (!Number.isNaN(n) && n >= 1) onChange(n)
      }}
      onBlur={commit}
      onSubmitEditing={commit}
      className={
        className ??
        'h-9 w-16 rounded-lg border border-line bg-background px-2 font-mono text-sm text-zinc-100'
      }
    />
  )
}

function PokerSetup({ config, onChange }: GameSetupProps<PokerBankConfig>) {
  const set = (patch: Partial<PokerBankConfig>) => onChange({ ...config, ...patch })
  const updateChip = (index: number, patch: Partial<PokerChipDenom>) => {
    set({ chips: config.chips.map((c, i) => (i === index ? { ...c, ...patch } : c)) })
  }

  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Muted>Starting stack (points)</Muted>
        <AppTextInput
          keyboardType="number-pad"
          value={String(config.startingStack)}
          onChangeText={(t) => {
            const n = Number.parseInt(t.replace(/\D/g, ''), 10)
            set({ startingStack: Number.isNaN(n) ? 0 : Math.min(1_000_000, n) })
          }}
          className="h-11 rounded-xl border border-line bg-background px-3 font-mono text-zinc-100"
        />
      </View>
      <View className="gap-1.5">
        <Muted>Display as</Muted>
        <Segmented
          value={config.currencyMode}
          onChange={(currencyMode) => set({ currencyMode })}
          options={[
            { value: 'points', label: 'Points' },
            { value: 'dollars', label: 'Dollars' },
          ]}
        />
      </View>
      <View className="gap-1.5">
        <Muted>Points per dollar</Muted>
        <PointsPerDollarField
          value={config.pointsPerDollar}
          onChange={(pointsPerDollar) => set({ pointsPerDollar })}
        />
      </View>
      <View className="gap-2">
        <Muted>Chip denominations</Muted>
        {config.chips.map((chip, index) => (
          <View key={chip.id} className="flex-row items-center gap-2 rounded-xl border border-line p-2">
            <PokerChip color={chip.color} size={28} label={String(chip.value)} />
            <AppTextInput
              value={chip.label}
              onChangeText={(label) => updateChip(index, { label: label.slice(0, 16) })}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-background px-2 text-sm text-zinc-100"
            />
            <ChipValueField
              value={chip.value}
              onChange={(value) => updateChip(index, { value })}
            />
            <ColorPicker
              value={chip.color}
              onChange={(color) => updateChip(index, { color })}
            />
          </View>
        ))}
        <AppButton
          size="sm"
          variant="outline"
          title="Add chip"
          onPress={() =>
            set({
              chips: [
                ...config.chips,
                { id: `chip-${config.chips.length + 1}`, label: 'New', value: 1, color: '#a1a1aa' },
              ],
            })
          }
        />
      </View>
    </View>
  )
}

function BankSettingsSheet({
  game,
  send,
  onClose,
}: {
  game: PokerBankState
  send: GamePlayProps['send']
  onClose: () => void
}) {
  const keyboardHeight = useKeyboardHeight()
  const [currencyMode, setCurrencyMode] = React.useState<PokerCurrencyMode>(game.config.currencyMode)
  const [pointsPerDollar, setPointsPerDollar] = React.useState(game.config.pointsPerDollar)
  const [startingStack, setStartingStack] = React.useState(game.config.startingStack)
  const [chips, setChips] = React.useState(game.config.chips)

  const updateChip = (index: number, patch: Partial<PokerChipDenom>) => {
    setChips(chips.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          className="rounded-t-3xl border border-line bg-card"
          style={{ marginBottom: keyboardHeight, maxHeight: '90%' }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, gap: 16 }}
          >
            <Text className="text-lg font-semibold text-zinc-100">Bank settings</Text>

            <View className="gap-1.5">
              <Muted>Display as</Muted>
              <Segmented
                value={currencyMode}
                onChange={setCurrencyMode}
                options={[
                  { value: 'points', label: 'Points' },
                  { value: 'dollars', label: 'Dollars' },
                ]}
              />
            </View>

            <View className="gap-1.5">
              <Muted>Points per dollar</Muted>
              <PointsPerDollarField value={pointsPerDollar} onChange={setPointsPerDollar} />
            </View>

            <View className="gap-1.5">
              <Muted>Starting stack (points)</Muted>
              <AppTextInput
                keyboardType="number-pad"
                value={String(startingStack)}
                onChangeText={(t) => {
                  const n = Number.parseInt(t.replace(/\D/g, ''), 10)
                  setStartingStack(Number.isNaN(n) ? 0 : Math.min(1_000_000, n))
                }}
                className="h-11 rounded-xl border border-line bg-background px-3 font-mono text-zinc-100"
              />
              <Muted>Applies to players who join after you save. Balances stay in points.</Muted>
            </View>

            <View className="gap-2">
              <Muted>Chip denominations</Muted>
              {chips.map((chip, index) => (
                <View
                  key={chip.id}
                  className="flex-row items-center gap-2 rounded-xl border border-line p-2"
                >
                  <PokerChip color={chip.color} size={28} label={String(chip.value)} />
                  <AppTextInput
                    value={chip.label}
                    onChangeText={(label) => updateChip(index, { label: label.slice(0, 16) })}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-background px-2 text-sm text-zinc-100"
                  />
                  <ChipValueField
                    value={chip.value}
                    onChange={(value) => updateChip(index, { value })}
                  />
                  <ColorPicker
                    value={chip.color}
                    onChange={(color) => updateChip(index, { color })}
                  />
                  {chips.length > 1 ? (
                    <Pressable
                      accessibilityLabel={`Remove ${chip.label}`}
                      onPress={() => setChips(chips.filter((_, i) => i !== index))}
                      className="h-9 w-9 items-center justify-center rounded-lg"
                    >
                      <Text className="text-lg text-zinc-400">×</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              <AppButton
                size="sm"
                variant="outline"
                title="Add chip"
                onPress={() =>
                  setChips([
                    ...chips,
                    {
                      id: `chip-${chips.length + 1}-${Date.now().toString(36)}`,
                      label: 'New',
                      value: 1,
                      color: '#a1a1aa',
                    },
                  ])
                }
              />
            </View>

            <View className="flex-row gap-2">
              <AppButton title="Cancel" variant="secondary" className="flex-1" onPress={onClose} />
              <AppButton
                title="Save bank"
                className="flex-1"
                onPress={() => {
                  const error = send({
                    type: 'updateConfig',
                    config: { currencyMode, pointsPerDollar, startingStack, chips },
                  })
                  if (!error) onClose()
                }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

type CashInputMode = PokerCurrencyMode | 'chips'

function parseChipCountDrafts(
  drafts: Record<string, string>,
  chips: PokerChipDenom[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const chip of chips) {
    const n = Number.parseInt(drafts[chip.id] ?? '', 10)
    if (!Number.isNaN(n) && n > 0) counts[chip.id] = n
  }
  return counts
}

function CashSheet({
  mode,
  player,
  game,
  send,
  onClose,
}: {
  mode: 'deposit' | 'withdraw'
  player: SessionPlayer
  game: PokerBankState
  send: GamePlayProps['send']
  onClose: () => void
}) {
  const keyboardHeight = useKeyboardHeight()
  const [amount, setAmount] = React.useState('')
  const [unit, setUnit] = React.useState<CashInputMode>(game.config.currencyMode)
  const [chipDrafts, setChipDrafts] = React.useState<Record<string, string>>({})
  const numeric = Number.parseFloat(amount)
  const chipPoints = pointsFromChipCounts(
    parseChipCountDrafts(chipDrafts, game.config.chips),
    game.config.chips,
  )
  const points =
    unit === 'chips'
      ? chipPoints
      : Number.isFinite(numeric) && numeric > 0
        ? toPoints(numeric, unit, game.config.pointsPerDollar)
        : 0
  const breakdown =
    mode === 'withdraw' && unit !== 'chips' ? chipBreakdown(points, game.config.chips) : []
  const balance = game.banks[player.id]?.balance ?? 0
  useSuppressAndroidKeyboardHost()

  const confirm = React.useCallback(() => {
    if (!(points > 0) || (mode === 'withdraw' && points > balance)) return
    const error = send({
      type: mode,
      playerId: player.id,
      amount: unit === 'chips' ? points : numeric,
      unit: unit === 'chips' ? 'points' : unit,
    })
    if (!error) onClose()
  }, [balance, mode, numeric, onClose, player.id, points, send, unit])

  const bumpChip = (chipId: string, delta: number) => {
    setChipDrafts((prev) => {
      const cur = Number.parseInt(prev[chipId] ?? '', 10)
      const n = Number.isNaN(cur) ? 0 : cur
      const next = Math.max(0, Math.min(999, n + delta))
      return { ...prev, [chipId]: next === 0 ? '' : String(next) }
    })
  }

  // Bottom sheet sits under the keyboard unless we lift it by the keyboard frame.
  // (RN Modals don't inherit the activity's adjustResize on Android.)
  // Local keyboard chrome — suppress the app-wide Android host while open.
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          className="rounded-t-3xl border border-line bg-card"
          style={{ marginBottom: keyboardHeight, maxHeight: '85%' }}
        >
          <KeyboardForm onSubmit={confirm}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                padding: 16,
                // Room for the floating check/dismiss cluster over the bottom-right edge.
                paddingBottom: keyboardHeight > 0 ? 56 : 16,
              }}
            >
            <Text className="mb-1 text-lg font-semibold text-zinc-100">
              {mode === 'deposit' ? 'Cash in' : 'Cash out'} · {player.name}
            </Text>
            <Muted className="mb-3">
              {mode === 'deposit'
                ? `Put chips into ${player.name}'s bank. Holding ${formatPokerAmount(balance, game.config)}.`
                : `Take chips out of ${player.name}'s bank. Holding ${formatPokerAmount(balance, game.config)}.`}
            </Muted>
            <Segmented
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'points', label: 'Points' },
                { value: 'dollars', label: 'Dollars' },
                { value: 'chips', label: 'Chips' },
              ]}
            />
            {unit === 'chips' ? (
              <View className="mt-3 gap-2">
                {game.config.chips.map((chip) => (
                  <View
                    key={chip.id}
                    className="flex-row items-center gap-2 rounded-xl border border-line px-2 py-2"
                  >
                    <PokerChip color={chip.color} size={28} label={String(chip.value)} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-medium text-zinc-100">{chip.label}</Text>
                      <Muted>{chip.value} pts each</Muted>
                    </View>
                    <Text className="text-muted-foreground">×</Text>
                    <View className="flex-row items-center gap-1">
                      <Pressable
                        accessibilityLabel={`Decrease ${chip.label}`}
                        onPress={() => bumpChip(chip.id, -1)}
                        className="h-9 w-9 items-center justify-center rounded-lg bg-muted active:opacity-70"
                      >
                        <MinusIcon size={16} color="#e4e4e7" />
                      </Pressable>
                      <AppTextInput
                        keyboardAccessory={false}
                        keyboardType="number-pad"
                        value={chipDrafts[chip.id] ?? ''}
                        onChangeText={(t) =>
                          setChipDrafts((prev) => ({
                            ...prev,
                            [chip.id]: t.replace(/\D/g, ''),
                          }))
                        }
                        placeholder="0"
                        placeholderTextColor="#71717a"
                        className="h-10 w-12 rounded-lg border border-line bg-background px-1 text-center font-mono text-base text-zinc-100"
                      />
                      <Pressable
                        accessibilityLabel={`Increase ${chip.label}`}
                        onPress={() => bumpChip(chip.id, 1)}
                        className="h-9 w-9 items-center justify-center rounded-lg bg-muted active:opacity-70"
                      >
                        <PlusIcon size={16} color="#e4e4e7" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="mt-3 flex-row items-center rounded-xl border border-line bg-background px-3">
                {unit === 'dollars' ? (
                  <DollarSignIcon size={18} color="#a1a1ab" accessibilityLabel="Dollars" />
                ) : null}
                <AppTextInput
                  autoFocus
                  keyboardAccessory={false}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                  placeholder={unit === 'dollars' ? '0.00' : '0'}
                  placeholderTextColor="#71717a"
                  className="h-12 min-w-0 flex-1 bg-transparent px-2 font-mono text-lg text-zinc-100"
                />
              </View>
            )}
            {points > 0 ? (
              <Muted className="mt-2">
                = {formatPokerAmount(points, { currencyMode: 'points', pointsPerDollar: 1 })}
                {game.config.currencyMode === 'dollars' || unit === 'dollars'
                  ? ` · ${formatPokerAmount(points, game.config)}`
                  : ''}
              </Muted>
            ) : null}
            {mode === 'withdraw' && breakdown.length > 0 && (
              <View className="mt-3 flex-row flex-wrap gap-3 rounded-xl border border-line p-3">
                {breakdown.map(({ chip, count }) => (
                  <View key={chip.id} className="flex-row items-center gap-2">
                    <PokerChip color={chip.color} size={32} label={String(chip.value)} />
                    <View>
                      <Text className="font-semibold text-zinc-100">×{count}</Text>
                      <Muted>{chip.label}</Muted>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <View className="mt-4 flex-row gap-2">
              <AppButton title="Cancel" variant="secondary" className="flex-1" onPress={onClose} />
              <AppButton
                title="Confirm"
                className="flex-1"
                disabled={!(points > 0) || (mode === 'withdraw' && points > balance)}
                onPress={confirm}
              />
            </View>
          </ScrollView>
          {keyboardHeight > 0 ? (
            <View pointerEvents="box-none" className="absolute bottom-1.5 right-2">
              <KeyboardActionButtons floating />
            </View>
          ) : null}
          </KeyboardForm>
        </View>
      </View>
    </Modal>
  )
}

function ClaimMergePanel() {
  const store = useSession()
  const state = store.state!
  const guests = state.players.filter((p) => !p.remote && !p.isHost)
  const remotes = state.players.filter((p) => p.remote)
  const [claimerId, setClaimerId] = React.useState(remotes[0]?.id ?? '')
  const [seatId, setSeatId] = React.useState(guests[0]?.id ?? '')
  const [fromId, setFromId] = React.useState('')
  const [toId, setToId] = React.useState('')

  return (
    <Card className="gap-3 p-4">
      <CardTitle>Seats & accounts</CardTitle>
      <Muted>Claim a guest seat when someone joins, or merge accounts later.</Muted>

      <View className="gap-2 rounded-xl border border-line p-3">
        <Text className="text-xs font-medium text-zinc-100">Claim guest seat</Text>
        {guests.length === 0 || remotes.length === 0 ? (
          <Muted>Need a host-created guest and a joined player.</Muted>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-1.5">
              {remotes.map((p) => (
                <Pressable key={p.id} onPress={() => setClaimerId(p.id)}>
                  <Chip tone={claimerId === p.id ? 'default' : 'outline'}>{p.name}</Chip>
                </Pressable>
              ))}
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {guests.map((p) => (
                <Pressable key={p.id} onPress={() => setSeatId(p.id)}>
                  <Chip tone={seatId === p.id ? 'default' : 'outline'}>{p.name} (guest)</Chip>
                </Pressable>
              ))}
            </View>
            <AppButton
              size="sm"
              title="Claim seat"
              disabled={!claimerId || !seatId}
              onPress={() => store.claimSeat(claimerId, seatId)}
            />
          </>
        )}
      </View>

      <View className="gap-2 rounded-xl border border-line p-3">
        <Text className="text-xs font-medium text-zinc-100">Merge accounts</Text>
        <Muted>Guest → player keeps the player. Player → player: pick the survivor.</Muted>
        <View className="flex-row flex-wrap gap-1.5">
          {state.players
            .filter((p) => !p.isHost)
            .map((p) => (
              <Pressable key={p.id} onPress={() => setFromId(p.id)}>
                <Chip tone={fromId === p.id ? 'default' : 'outline'}>
                  Away: {p.name}
                </Chip>
              </Pressable>
            ))}
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          {state.players
            .filter((p) => p.id !== fromId)
            .map((p) => (
              <Pressable key={p.id} onPress={() => setToId(p.id)}>
                <Chip tone={toId === p.id ? 'default' : 'outline'}>Into: {p.name}</Chip>
              </Pressable>
            ))}
        </View>
        <AppButton
          size="sm"
          variant="secondary"
          title="Merge"
          disabled={!fromId || !toId}
          onPress={() => store.mergePlayers(fromId, toId)}
        />
      </View>
    </Card>
  )
}

function GuestProfileModal({
  title,
  confirmLabel,
  initialName,
  initialEmoji,
  onClose,
  onConfirm,
}: {
  title: string
  confirmLabel: string
  initialName: string
  initialEmoji: string
  onClose: () => void
  onConfirm: (profile: { name: string; emoji: string }) => void
}) {
  const [name, setName] = React.useState(initialName)
  const [emoji, setEmoji] = React.useState(initialEmoji)

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={onClose}>
        <Pressable className="w-full gap-3 rounded-2xl border border-line bg-card p-4" onPress={() => {}}>
          <Text className="text-lg font-semibold text-zinc-100">{title}</Text>
          <View>
            <SectionLabel>Name</SectionLabel>
            <AppTextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="e.g. Cousin Mike"
              placeholderTextColor="#71717a"
              maxLength={24}
              className="h-11 rounded-xl border border-line bg-background px-3 text-zinc-100"
            />
          </View>
          <View>
            <SectionLabel>Emoji</SectionLabel>
            <EmojiGrid value={emoji} onChange={setEmoji} />
          </View>
          <View className="flex-row gap-2">
            <AppButton title="Cancel" variant="secondary" className="flex-1" onPress={onClose} />
            <AppButton
              title={confirmLabel}
              className="flex-1"
              disabled={!name.trim()}
              onPress={() => onConfirm({ name: name.trim(), emoji })}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function AddGuestButton() {
  const addLocalPlayer = useSession((s) => s.addLocalPlayer)
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <AppButton size="sm" variant="outline" title="Add guest" onPress={() => setOpen(true)} />
      {open ? (
        <GuestProfileModal
          title="Add a guest seat"
          confirmLabel="Add"
          initialName=""
          initialEmoji={randomEmoji()}
          onClose={() => setOpen(false)}
          onConfirm={({ name, emoji }) => {
            addLocalPlayer({ name, emoji })
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function GuestIdentity({
  player,
  balanceLabel,
  editable,
}: {
  player: SessionPlayer
  balanceLabel: string
  editable: boolean
}) {
  const updateLocalPlayer = useSession((s) => s.updateLocalPlayer)
  const [open, setOpen] = React.useState(false)
  const isGuest = !player.remote && !player.isHost

  const body = (
    <>
      <PlayerAvatar player={player} size="sm" showPresence />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>
            {player.name}
          </Text>
          {isGuest ? <Chip tone="outline">guest</Chip> : null}
        </View>
        <Text className="font-mono text-sm font-bold text-primary">{balanceLabel}</Text>
      </View>
    </>
  )

  if (!editable) {
    return <View className="min-w-0 flex-1 flex-row items-center gap-3">{body}</View>
  }

  return (
    <>
      <Pressable
        accessibilityLabel={`Edit ${player.name}`}
        onPress={() => setOpen(true)}
        className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
      >
        {body}
      </Pressable>
      {open ? (
        <GuestProfileModal
          title="Edit guest"
          confirmLabel="Save"
          initialName={player.name}
          initialEmoji={player.emoji}
          onClose={() => setOpen(false)}
          onConfirm={({ name, emoji }) => {
            updateLocalPlayer(player.id, { name, emoji })
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function PokerPlay({ state, me, isHost, send }: GamePlayProps) {
  const game = state.game as PokerBankState
  const ranked = [...state.players].sort(
    (a, b) => (game.banks[b.id]?.balance ?? 0) - (game.banks[a.id]?.balance ?? 0),
  )
  const [cash, setCash] = React.useState<{ mode: 'deposit' | 'withdraw'; player: SessionPlayer } | null>(
    null,
  )
  const [editingBank, setEditingBank] = React.useState(false)
  const recent = [...game.ledger].slice(-8).reverse()

  return (
    <View className="gap-4">
      <Card className="gap-2 p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1 gap-1">
            <CardTitle>Bank</CardTitle>
            <Muted>
              Start {formatPokerAmount(game.config.startingStack, game.config)}
              {' · '}
              {game.config.currencyMode === 'dollars'
                ? `Dollars · ${game.config.pointsPerDollar} pts/$`
                : 'Points'}
            </Muted>
          </View>
          {isHost ? (
            <Pressable
              accessibilityLabel="Edit bank settings"
              onPress={() => setEditingBank(true)}
              className="flex-row items-center gap-1.5 rounded-full border border-line px-3 py-1.5 active:opacity-80"
            >
              <Settings2Icon size={14} color="#f4f4f5" />
              <Text className="text-xs font-medium text-zinc-100">Edit</Text>
            </Pressable>
          ) : null}
        </View>
        <View className="mt-1 flex-row flex-wrap gap-2">
          {game.config.chips.map((chip) => (
            <View key={chip.id} className="flex-row items-center gap-1.5 rounded-full border border-line px-2 py-1">
              <PokerChip color={chip.color} size={28} label={String(chip.value)} />
              <Text className="text-sm font-semibold text-zinc-100">
                {chip.label} · {chip.value}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View className="gap-2">
        {ranked.map((player) => {
          const balance = game.banks[player.id]?.balance ?? 0
          const mine = me?.id === player.id
          const canAct = isHost || mine
          const isGuest = !player.remote && !player.isHost
          return (
            <Card key={player.id} className={`gap-3 p-3.5 ${mine ? 'border-primary/40' : ''}`}>
              <View className="flex-row items-center gap-3">
                <GuestIdentity
                  player={player}
                  balanceLabel={formatPokerAmount(balance, game.config)}
                  editable={Boolean(isHost && isGuest)}
                />
              </View>
              {canAct && (
                <View className="flex-row gap-2">
                  <AppButton
                    size="sm"
                    title="Cash in"
                    className="flex-1"
                    onPress={() => setCash({ mode: 'deposit', player })}
                  />
                  <AppButton
                    size="sm"
                    variant="secondary"
                    title="Cash out"
                    className="flex-1"
                    onPress={() => setCash({ mode: 'withdraw', player })}
                  />
                </View>
              )}
            </Card>
          )
        })}
      </View>

      {isHost && <AddGuestButton />}
      {isHost && <ClaimMergePanel />}

      {recent.length > 0 && (
        <Card className="gap-1.5 p-4">
          <CardTitle>Recent activity</CardTitle>
          {recent.map((entry) => {
            const who = state.players.find((p) => p.id === entry.playerId)?.name ?? 'Player'
            const sign = entry.points >= 0 ? '+' : ''
            return (
              <View key={entry.id} className="flex-row items-center justify-between gap-2">
                <Text className="min-w-0 flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                  <Text className="font-medium text-zinc-300">{who}</Text> {entry.kind}
                </Text>
                <Text className="font-mono text-xs text-muted-foreground">
                  {sign}
                  {formatPokerAmount(Math.abs(entry.points), game.config)}
                </Text>
              </View>
            )
          })}
        </Card>
      )}

      {cash && (
        <CashSheet
          mode={cash.mode}
          player={cash.player}
          game={game}
          send={send}
          onClose={() => setCash(null)}
        />
      )}
      {editingBank ? (
        <BankSettingsSheet game={game} send={send} onClose={() => setEditingBank(false)} />
      ) : null}
    </View>
  )
}

export const pokerBankUI: GameUIModule = {
  id: 'poker-bank',
  icon: CoinsIcon,
  SetupForm: PokerSetup as GameUIModule['SetupForm'],
  PlayView: PokerPlay,
  configSummary: (config) => {
    const c = config as PokerBankConfig
    return [
      `Start ${c.startingStack} pts`,
      c.currencyMode === 'dollars' ? `${c.pointsPerDollar} pts/$` : 'Points',
      `${c.chips.length} chips`,
    ]
  },
}
