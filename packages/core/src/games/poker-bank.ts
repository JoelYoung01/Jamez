import type { SessionPlayer } from '../protocol/session-state'
import { randomId } from '../util/ids'
import {
  formatPoints,
  namesList,
  type ActionContext,
  type GameEngine,
  type GameSummary,
} from './types'

/**
 * Poker Bank — a long-running chip bank rather than a hand-by-hand game.
 *
 * Players join with a starting stack; anyone (or the host on their behalf)
 * can deposit / withdraw at any time. The host configures chip denominations
 * and colors; UIs break withdrawals into physical chip counts.
 */

export type PokerCurrencyMode = 'points' | 'dollars'

export interface PokerChipDenom {
  id: string
  /** Display label, e.g. "Red". */
  label: string
  /** Value of one chip in points. */
  value: number
  /** Fill color for the chip SVG (hex). */
  color: string
}

export interface PokerBankConfig {
  /** Points each player receives when they join / the bank opens. */
  startingStack: number
  currencyMode: PokerCurrencyMode
  /** How many points equal $1. Defaults to 1. */
  pointsPerDollar: number
  chips: PokerChipDenom[]
}

export type PokerLedgerKind = 'start' | 'deposit' | 'withdraw' | 'claim' | 'merge' | 'adjust'

export interface PokerLedgerEntry {
  id: string
  at: number
  playerId: string
  kind: PokerLedgerKind
  /** Signed points delta applied to this player. */
  points: number
  by: string
  note?: string
  meta?: Record<string, string>
}

export interface PokerPlayerBank {
  balance: number
}

export interface PokerBankState {
  config: PokerBankConfig
  banks: Record<string, PokerPlayerBank>
  ledger: PokerLedgerEntry[]
}

export type PokerBankAction =
  | {
      type: 'deposit'
      playerId: string
      amount: number
      unit: PokerCurrencyMode
    }
  | {
      type: 'withdraw'
      playerId: string
      amount: number
      unit: PokerCurrencyMode
    }
  | {
      type: 'updateConfig'
      /** Partial config patch; chips replace wholesale when provided. */
      config: Partial<Omit<PokerBankConfig, 'chips'>> & { chips?: PokerChipDenom[] }
    }

export const DEFAULT_POKER_CHIPS: PokerChipDenom[] = [
  { id: 'white', label: 'White', value: 1, color: '#f4f4f5' },
  { id: 'red', label: 'Red', value: 5, color: '#ef4444' },
  { id: 'green', label: 'Green', value: 25, color: '#22c55e' },
  { id: 'blue', label: 'Blue', value: 100, color: '#3b82f6' },
  { id: 'black', label: 'Black', value: 500, color: '#18181b' },
  { id: 'purple', label: 'Purple', value: 1000, color: '#a855f7' },
]

/** Deep-clone a poker bank config (chips included). */
export function clonePokerBankConfig(config: PokerBankConfig): PokerBankConfig {
  return {
    startingStack: config.startingStack,
    currencyMode: config.currencyMode,
    pointsPerDollar: config.pointsPerDollar,
    chips: config.chips.map((c) => ({ ...c })),
  }
}

/**
 * Prefer the live bank settings (`game.config`) when present; otherwise the
 * lobby-time `gameConfig`. Returns null when the session is not a poker bank.
 */
export function pokerBankConfigFromSession(state: {
  gameId: string
  gameConfig?: unknown
  game?: unknown
}): PokerBankConfig | null {
  if (state.gameId !== 'poker-bank') return null
  const live = state.game as PokerBankState | null | undefined
  if (live?.config?.chips?.length) return clonePokerBankConfig(live.config)
  const lobby = state.gameConfig as PokerBankConfig | undefined
  if (lobby?.chips?.length) return clonePokerBankConfig(lobby)
  return null
}

/** Common chip colors offered by the config color picker (hex, 6-digit). */
export const CHIP_COLOR_PRESETS: readonly string[] = [
  '#f4f4f5',
  '#a1a1aa',
  '#18181b',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#f59e0b',
  '#84cc16',
  '#0ea5e9',
  '#78716c',
]

export function defaultPokerBankConfig(): PokerBankConfig {
  return {
    startingStack: 500,
    currencyMode: 'points',
    pointsPerDollar: 1,
    chips: DEFAULT_POKER_CHIPS.map((c) => ({ ...c })),
  }
}

export function toPoints(
  amount: number,
  unit: PokerCurrencyMode,
  pointsPerDollar: number,
): number {
  if (unit === 'points') return amount
  const rate = pointsPerDollar > 0 ? pointsPerDollar : 1
  return Math.round(amount * rate)
}

export function fromPoints(
  points: number,
  unit: PokerCurrencyMode,
  pointsPerDollar: number,
): number {
  if (unit === 'points') return points
  const rate = pointsPerDollar > 0 ? pointsPerDollar : 1
  return points / rate
}

export function formatPokerAmount(
  points: number,
  config: Pick<PokerBankConfig, 'currencyMode' | 'pointsPerDollar'>,
): string {
  if (config.currencyMode === 'dollars') {
    const dollars = fromPoints(points, 'dollars', config.pointsPerDollar)
    const rounded = Math.round(dollars * 100) / 100
    return `$${rounded.toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
      maximumFractionDigits: 2,
    })}`
  }
  return formatPoints(points)
}

/** Greedy chip breakdown (highest denomination first). */
export function chipBreakdown(
  points: number,
  chips: PokerChipDenom[],
): { chip: PokerChipDenom; count: number }[] {
  if (!Number.isFinite(points) || points <= 0) return []
  const ordered = [...chips].filter((c) => c.value > 0).sort((a, b) => b.value - a.value)
  let remaining = Math.floor(points)
  const out: { chip: PokerChipDenom; count: number }[] = []
  for (const chip of ordered) {
    const count = Math.floor(remaining / chip.value)
    if (count > 0) {
      out.push({ chip, count })
      remaining -= count * chip.value
    }
  }
  return out
}

function validateChip(chip: PokerChipDenom): string | null {
  if (!chip.id.trim()) return 'Chip id is required'
  if (!chip.label.trim()) return 'Chip label is required'
  if (!Number.isInteger(chip.value) || chip.value <= 0) return 'Chip value must be a positive whole number'
  if (!/^#[0-9a-fA-F]{6}$/.test(chip.color)) return 'Chip color must be a hex color like #ff0000'
  return null
}

function validateConfigShape(config: PokerBankConfig): string | null {
  if (!Number.isInteger(config.startingStack) || config.startingStack < 0) {
    return 'Starting stack must be a non-negative whole number'
  }
  if (config.startingStack > 1_000_000) return 'Starting stack is too large'
  if (!(config.pointsPerDollar > 0) || config.pointsPerDollar > 1_000_000) {
    return 'Points per dollar must be a positive number'
  }
  if (!config.chips.length) return 'Add at least one chip denomination'
  const seen = new Set<string>()
  for (const chip of config.chips) {
    const err = validateChip(chip)
    if (err) return err
    if (seen.has(chip.id)) return `Duplicate chip id: ${chip.id}`
    seen.add(chip.id)
  }
  return null
}

function appendLedger(
  state: PokerBankState,
  entry: Omit<PokerLedgerEntry, 'id'>,
): PokerBankState {
  return {
    ...state,
    ledger: [...state.ledger, { ...entry, id: randomId(8) }],
  }
}

function grantStart(
  state: PokerBankState,
  playerId: string,
  by: string,
  at: number,
): PokerBankState {
  const amount = state.config.startingStack
  const withBank: PokerBankState = {
    ...state,
    banks: { ...state.banks, [playerId]: { balance: amount } },
  }
  if (amount === 0) return withBank
  return appendLedger(withBank, {
    at,
    playerId,
    kind: 'start',
    points: amount,
    by,
    note: 'Starting stack',
  })
}

export const pokerBankEngine: GameEngine<PokerBankConfig, PokerBankState, PokerBankAction> = {
  id: 'poker-bank',
  name: 'Poker Bank',
  tagline: 'Long-running chip bank with cash-in / cash-out',
  accentColor: '#e11d48',
  minPlayers: 1,
  maxPlayers: 24,
  allowLateJoin: true,
  sessionMode: 'ongoing',

  defaultConfig: defaultPokerBankConfig,

  init(config, players) {
    const normalized: PokerBankConfig = {
      ...defaultPokerBankConfig(),
      ...config,
      chips: (config.chips?.length ? config.chips : DEFAULT_POKER_CHIPS).map((c) => ({ ...c })),
    }
    let state: PokerBankState = { config: normalized, banks: {}, ledger: [] }
    const at = Date.now()
    for (const player of players) {
      state = grantStart(state, player.id, player.id, at)
    }
    return state
  },

  validateAction(state, action, ctx: ActionContext) {
    if (action.type === 'updateConfig') {
      if (!ctx.isHost) return 'Only the host can update bank settings'
      const next: PokerBankConfig = {
        ...state.config,
        ...action.config,
        chips: action.config.chips ?? state.config.chips,
      }
      return validateConfigShape(next)
    }

    const bank = state.banks[action.playerId]
    if (!bank) return 'Unknown player'
    if (action.playerId !== ctx.actorId && !ctx.isHost) {
      return 'You can only cash in or out for yourself'
    }
    if (!(action.amount > 0) || !Number.isFinite(action.amount)) {
      return 'Amount must be greater than zero'
    }
    if (action.unit === 'points' && !Number.isInteger(action.amount)) {
      return 'Point amounts must be whole numbers'
    }
    const points = toPoints(action.amount, action.unit, state.config.pointsPerDollar)
    if (points <= 0) return 'Amount is too small'
    if (points > 10_000_000) return 'Amount is too large'
    if (action.type === 'withdraw' && points > bank.balance) {
      return 'Not enough balance'
    }
    return null
  },

  applyAction(state, action, ctx) {
    if (action.type === 'updateConfig') {
      return {
        ...state,
        config: {
          ...state.config,
          ...action.config,
          chips: action.config.chips ?? state.config.chips,
        },
      }
    }

    const points = toPoints(action.amount, action.unit, state.config.pointsPerDollar)
    const bank = state.banks[action.playerId]!
    const delta = action.type === 'deposit' ? points : -points
    const next: PokerBankState = {
      ...state,
      banks: {
        ...state.banks,
        [action.playerId]: { balance: bank.balance + delta },
      },
    }
    return appendLedger(next, {
      at: ctx.now,
      playerId: action.playerId,
      kind: action.type,
      points: delta,
      by: ctx.actorId,
    })
  },

  isFinished() {
    return false
  },

  summary(state, players): GameSummary {
    const rows = players
      .map((p) => ({
        playerId: p.id,
        score: state.banks[p.id]?.balance ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
    let lastScore: number | null = null
    let lastRank = 0
    const ranked = rows.map((row, i) => {
      if (lastScore === null || row.score !== lastScore) {
        lastRank = i + 1
        lastScore = row.score
      }
      return { ...row, rank: lastRank }
    })
    const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown'
    const leaders = ranked.filter((r) => r.rank === 1)
    const top = leaders[0]
    const headline =
      leaders.length === 1 && top
        ? `${nameOf(top.playerId)} leads with ${formatPokerAmount(top.score, state.config)}`
        : top
          ? `${namesList(leaders.map((l) => nameOf(l.playerId)))} share the lead at ${formatPokerAmount(top.score, state.config)}`
          : 'Bank settled'
    return {
      headline,
      winnerIds: leaders.map((l) => l.playerId),
      entries: ranked.map((r) => ({
        playerId: r.playerId,
        rank: r.rank,
        score: r.score,
        scoreText: formatPokerAmount(r.score, state.config),
      })),
    }
  },

  addPlayer(state, player) {
    if (state.banks[player.id]) return state
    return grantStart(state, player.id, player.id, Date.now())
  },

  removePlayer(state, playerId) {
    if (!state.banks[playerId]) return state
    const banks = { ...state.banks }
    delete banks[playerId]
    return { ...state, banks }
  },

  claimSeat(state, seatId, claimerId) {
    const seat = state.banks[seatId]
    if (!seat) return state
    const banks = { ...state.banks }
    banks[claimerId] = { balance: seat.balance }
    delete banks[seatId]
    return appendLedger(
      { ...state, banks },
      {
        at: Date.now(),
        playerId: claimerId,
        kind: 'claim',
        points: seat.balance,
        by: claimerId,
        note: 'Claimed guest seat',
        meta: { seatId },
      },
    )
  },

  mergePlayers(state, fromId, toId) {
    const from = state.banks[fromId]
    const to = state.banks[toId]
    if (!from || !to) return state
    const banks = { ...state.banks }
    banks[toId] = { balance: to.balance + from.balance }
    delete banks[fromId]
    return appendLedger(
      { ...state, banks },
      {
        at: Date.now(),
        playerId: toId,
        kind: 'merge',
        points: from.balance,
        by: toId,
        note: 'Merged accounts',
        meta: { fromId },
      },
    )
  },
}
