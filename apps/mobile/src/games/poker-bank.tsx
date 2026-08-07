import {
  chipBreakdown,
  formatPokerAmount,
  toPoints,
  type PokerBankConfig,
  type PokerBankState,
  type PokerChipDenom,
  type PokerCurrencyMode,
  type SessionPlayer,
} from '@jamez/core'
import { CoinsIcon } from 'lucide-react-native'
import * as React from 'react'
import { Modal, Pressable, Text, TextInput, View } from 'react-native'
import { ColorPicker } from '@/components/color-picker'
import { PokerChip } from '@/components/poker-chip'
import { PlayerAvatar } from '@/components/player-avatar'
import { Segmented } from '@/components/segmented'
import { AppButton, Card, CardTitle, Chip, Muted } from '@/components/ui'
import { randomEmoji } from '@/lib/profile'
import { useSession } from '@/lib/session-store'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

function PokerSetup({ config, onChange }: GameSetupProps<PokerBankConfig>) {
  const set = (patch: Partial<PokerBankConfig>) => onChange({ ...config, ...patch })
  const updateChip = (index: number, patch: Partial<PokerChipDenom>) => {
    set({ chips: config.chips.map((c, i) => (i === index ? { ...c, ...patch } : c)) })
  }

  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Muted>Starting stack (points)</Muted>
        <TextInput
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
        <TextInput
          keyboardType="decimal-pad"
          value={String(config.pointsPerDollar)}
          onChangeText={(t) => {
            const n = Number.parseFloat(t)
            set({ pointsPerDollar: Number.isFinite(n) && n > 0 ? n : 1 })
          }}
          className="h-11 rounded-xl border border-line bg-background px-3 font-mono text-zinc-100"
        />
      </View>
      <View className="gap-2">
        <Muted>Chip denominations</Muted>
        {config.chips.map((chip, index) => (
          <View key={chip.id} className="flex-row items-center gap-2 rounded-xl border border-line p-2">
            <PokerChip color={chip.color} size={28} label={String(chip.value)} />
            <TextInput
              value={chip.label}
              onChangeText={(label) => updateChip(index, { label: label.slice(0, 16) })}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-background px-2 text-sm text-zinc-100"
            />
            <TextInput
              keyboardType="number-pad"
              value={String(chip.value)}
              onChangeText={(t) => {
                const n = Number.parseInt(t.replace(/\D/g, ''), 10)
                updateChip(index, { value: Number.isNaN(n) ? 1 : Math.max(1, n) })
              }}
              className="h-9 w-16 rounded-lg border border-line bg-background px-2 font-mono text-sm text-zinc-100"
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
  const [amount, setAmount] = React.useState('')
  const [unit, setUnit] = React.useState<PokerCurrencyMode>(game.config.currencyMode)
  const numeric = Number.parseFloat(amount)
  const points =
    Number.isFinite(numeric) && numeric > 0
      ? toPoints(numeric, unit, game.config.pointsPerDollar)
      : 0
  const breakdown = mode === 'withdraw' ? chipBreakdown(points, game.config.chips) : []
  const balance = game.banks[player.id]?.balance ?? 0

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable className="rounded-t-3xl border border-line bg-card p-4" onPress={() => {}}>
          <Text className="mb-1 text-lg font-semibold text-zinc-100">
            {mode === 'deposit' ? 'Cash in' : 'Cash out'} · {player.name}
          </Text>
          <Muted className="mb-3">Balance {formatPokerAmount(balance, game.config)}</Muted>
          <Segmented
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'points', label: 'Points' },
              { value: 'dollars', label: 'Dollars' },
            ]}
          />
          <TextInput
            autoFocus
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
            placeholder={unit === 'dollars' ? '0.00' : '0'}
            placeholderTextColor="#71717a"
            className="mt-3 h-12 rounded-xl border border-line bg-background px-3 font-mono text-lg text-zinc-100"
          />
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
              disabled={!(numeric > 0) || (mode === 'withdraw' && points > balance)}
              onPress={() => {
                send({ type: mode, playerId: player.id, amount: numeric, unit })
                onClose()
              }}
            />
          </View>
        </Pressable>
      </Pressable>
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

function AddGuestButton() {
  const addLocalPlayer = useSession((s) => s.addLocalPlayer)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')

  if (!open) {
    return <AppButton size="sm" variant="outline" title="Add guest" onPress={() => setOpen(true)} />
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setOpen(false)}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={() => setOpen(false)}>
        <Pressable className="w-full gap-3 rounded-2xl border border-line bg-card p-4" onPress={() => {}}>
          <Text className="text-lg font-semibold text-zinc-100">Add a guest seat</Text>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#71717a"
            maxLength={24}
            className="h-11 rounded-xl border border-line bg-background px-3 text-zinc-100"
          />
          <View className="flex-row gap-2">
            <AppButton title="Cancel" variant="secondary" className="flex-1" onPress={() => setOpen(false)} />
            <AppButton
              title="Add"
              className="flex-1"
              disabled={!name.trim()}
              onPress={() => {
                addLocalPlayer({ name: name.trim(), emoji: randomEmoji() })
                setName('')
                setOpen(false)
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
  const recent = [...game.ledger].slice(-8).reverse()

  return (
    <View className="gap-4">
      <Card className="gap-2 p-4">
        <CardTitle>Bank</CardTitle>
        <Muted>
          Start {formatPokerAmount(game.config.startingStack, game.config)}
          {game.config.currencyMode === 'dollars' ? ` · ${game.config.pointsPerDollar} pts/$` : ''}
        </Muted>
        <View className="mt-1 flex-row flex-wrap gap-2">
          {game.config.chips.map((chip) => (
            <View key={chip.id} className="flex-row items-center gap-1.5 rounded-full border border-line px-2 py-1">
              <PokerChip color={chip.color} size={18} />
              <Text className="text-xs text-zinc-100">
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
          return (
            <Card key={player.id} className={`gap-3 p-3.5 ${mine ? 'border-primary/40' : ''}`}>
              <View className="flex-row items-center gap-3">
                <PlayerAvatar player={player} size="sm" showPresence />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>
                      {player.name}
                    </Text>
                    {!player.remote && !player.isHost ? <Chip tone="outline">guest</Chip> : null}
                  </View>
                  <Text className="font-mono text-sm font-bold text-primary">
                    {formatPokerAmount(balance, game.config)}
                  </Text>
                </View>
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
