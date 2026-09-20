import type { SessionPlayer } from '../protocol/session-state'
import { formatPoints, namesList, type ActionContext, type GameEngine, type GameSummary } from './types'

/**
 * Cribbage match scoring (Bicycle Cards / standard two-hand rules):
 *
 * - Race to a target (default 121; shorter games often play to 61).
 * - Points are pegged as they happen: His Heels, play combinations (15, pairs,
 *   runs, Go, 31), then hand and crib counts.
 * - The game ends as soon as a player reaches the target, mid-hand or after a
 *   count.
 * - If the winner reaches the target before the loser has crossed the skunk /
 *   lurch line (default halfway: 61 on a 121-point board), the loser is
 *   "lurched" and the win counts as a double game.
 *
 * This engine is a digital pegboard + optional hand calculator — it does not
 * deal cards or enforce the play sequence.
 */

export type CribbageRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export type CribbageSuit = 'S' | 'H' | 'D' | 'C'

export interface CribbageCard {
  rank: CribbageRank
  suit: CribbageSuit
}

/** Why the points were pegged (for the log / UI labels). */
export type CribbagePegKind =
  | 'heels'
  | 'fifteen'
  | 'pair'
  | 'triplet'
  | 'four'
  | 'run'
  | 'go'
  | 'thirtyOne'
  | 'hand'
  | 'crib'
  | 'nobs'
  | 'custom'

export interface CribbageConfig {
  /** First player to reach this total wins (Bicycle default: 121). */
  targetScore: number
  /**
   * Loser below this line is lurched / skunked when the match ends at the
   * target (Bicycle halfway mark: 61 on a 121 board).
   */
  skunkLine: number
}

export interface CribbagePeg {
  n: number
  playerId: string
  points: number
  kind: CribbagePegKind
  recordedBy: string
  at: number
}

export interface CribbageState {
  config: CribbageConfig
  playerIds: [string, string]
  dealerId: string | null
  pegs: CribbagePeg[]
}

export type CribbageAction =
  | { type: 'peg'; playerId: string; points: number; kind?: CribbagePegKind }
  | { type: 'undoPeg' }
  | { type: 'setDealer'; playerId: string }
  | { type: 'nextDeal' }

export interface CribbageHandBreakdown {
  fifteens: number
  pairs: number
  runs: number
  flush: number
  nobs: number
  total: number
}

export const CRIBBAGE_RANKS: readonly CribbageRank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const

export const CRIBBAGE_SUITS: readonly CribbageSuit[] = ['S', 'H', 'D', 'C'] as const

/** Common peg amounts during play (15/pair/Go/31/runs/pair-royal). */
export const CRIBBAGE_QUICK_PEGS = [1, 2, 3, 4, 5, 6, 8, 12] as const

export const CRIBBAGE_PEG_KIND_LABELS: Record<CribbagePegKind, string> = {
  heels: 'His Heels',
  fifteen: 'Fifteen',
  pair: 'Pair',
  triplet: 'Triplet',
  four: 'Four of a kind',
  run: 'Run',
  go: 'Go',
  thirtyOne: '31',
  hand: 'Hand',
  crib: 'Crib',
  nobs: 'His Nobs',
  custom: 'Peg',
}

/** Pip value used for 15s and the running total in play. */
export function cribbagePipValue(rank: CribbageRank): number {
  if (rank === 'A') return 1
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number.parseInt(rank, 10)
}

/** Sequence order: Ace is always low and cannot run with the King. */
export function cribbageSequenceValue(rank: CribbageRank): number {
  return CRIBBAGE_RANKS.indexOf(rank) + 1
}

function combinationsOfIndices(n: number, k: number): number[][] {
  const out: number[][] = []
  const path: number[] = []
  const walk = (start: number) => {
    if (path.length === k) {
      out.push([...path])
      return
    }
    for (let i = start; i < n; i++) {
      path.push(i)
      walk(i + 1)
      path.pop()
    }
  }
  walk(0)
  return out
}

/**
 * Score a counted hand (four cards + starter) per Bicycle combination rules.
 * Flush: non-crib awards 4 for the hand suit alone and 5 when the starter
 * matches; the crib only scores a flush when all five cards share a suit.
 */
export function scoreCribbageHand(
  hand: CribbageCard[],
  starter: CribbageCard,
  opts: { isCrib?: boolean } = {},
): CribbageHandBreakdown {
  if (hand.length !== 4) {
    throw new Error('A cribbage hand must have exactly four cards')
  }
  const isCrib = opts.isCrib === true
  const cards = [...hand, starter]

  let fifteens = 0
  for (let k = 2; k <= 5; k++) {
    for (const idxs of combinationsOfIndices(5, k)) {
      const sum = idxs.reduce((s, i) => s + cribbagePipValue(cards[i]!.rank), 0)
      if (sum === 15) fifteens += 2
    }
  }

  const byRank = new Map<CribbageRank, number>()
  for (const card of cards) {
    byRank.set(card.rank, (byRank.get(card.rank) ?? 0) + 1)
  }
  let pairs = 0
  for (const count of byRank.values()) {
    if (count >= 2) pairs += (count * (count - 1) / 2) * 2
  }

  const freq = Array.from({ length: 14 }, () => 0)
  for (const card of cards) {
    freq[cribbageSequenceValue(card.rank)]! += 1
  }
  let runs = 0
  let i = 1
  while (i <= 13) {
    if (freq[i]! === 0) {
      i += 1
      continue
    }
    let j = i
    let length = 0
    let mult = 1
    while (j <= 13 && freq[j]! > 0) {
      length += 1
      mult *= freq[j]!
      j += 1
    }
    if (length >= 3) runs += length * mult
    i = j
  }

  let flush = 0
  const handSuit = hand[0]!.suit
  const handFlush = hand.every((c) => c.suit === handSuit)
  if (isCrib) {
    if (handFlush && starter.suit === handSuit) flush = 5
  } else if (handFlush) {
    flush = starter.suit === handSuit ? 5 : 4
  }

  let nobs = 0
  for (const card of hand) {
    if (card.rank === 'J' && card.suit === starter.suit) nobs += 1
  }

  return {
    fifteens,
    pairs,
    runs,
    flush,
    nobs,
    total: fifteens + pairs + runs + flush + nobs,
  }
}

/** Running peg totals. */
export function cribbageTotals(state: CribbageState): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const id of state.playerIds) totals[id] = 0
  for (const peg of state.pegs) {
    totals[peg.playerId] = (totals[peg.playerId] ?? 0) + peg.points
  }
  return totals
}

/** True when the match finished at the target and the loser is below the skunk line. */
export function cribbageIsSkunk(state: CribbageState): boolean {
  if (!cribbageReachedTarget(state)) return false
  const totals = cribbageTotals(state)
  const [a, b] = state.playerIds
  const aScore = totals[a] ?? 0
  const bScore = totals[b] ?? 0
  const loserScore = aScore >= bScore ? bScore : aScore
  return loserScore < state.config.skunkLine
}

function cribbageReachedTarget(state: CribbageState): boolean {
  const totals = cribbageTotals(state)
  return state.playerIds.some((id) => (totals[id] ?? 0) >= state.config.targetScore)
}

const MAX_PEG = 40

function validatePegPoints(points: number): string | null {
  if (!Number.isInteger(points)) return 'Points must be a whole number'
  if (points < 1) return 'Peg at least 1 point'
  if (points > MAX_PEG) return 'That peg is too large'
  return null
}

export const cribbageEngine: GameEngine<CribbageConfig, CribbageState, CribbageAction> = {
  id: 'cribbage',
  name: 'Cribbage',
  tagline: 'Peg to 121 — heels, plays, hands and crib',
  accentColor: '#86efac',
  minPlayers: 2,
  maxPlayers: 2,
  allowLateJoin: false,

  defaultConfig(): CribbageConfig {
    return {
      targetScore: 121,
      skunkLine: 61,
    }
  },

  init(config, players) {
    const ids = players.map((p) => p.id)
    return {
      config,
      playerIds: [ids[0]!, ids[1]!],
      dealerId: ids[0] ?? null,
      pegs: [],
    }
  },

  validateAction(state, action, ctx: ActionContext) {
    if (action.type === 'undoPeg') {
      if (!ctx.isHost) return 'Only the host can undo a peg'
      if (state.pegs.length === 0) return 'No pegs to undo'
      return null
    }
    if (action.type === 'setDealer') {
      if (!ctx.isHost) return 'Only the host can set the dealer'
      if (!state.playerIds.includes(action.playerId)) return 'Unknown player'
      return null
    }
    if (action.type === 'nextDeal') {
      if (!ctx.isHost) return 'Only the host can rotate the deal'
      if (!state.dealerId) return 'Set a dealer first'
      return null
    }

    if (!state.playerIds.includes(action.playerId)) return 'Unknown player'
    if (action.playerId !== ctx.actorId && !ctx.isHost) {
      return 'You can only peg points for yourself'
    }
    const pointsError = validatePegPoints(action.points)
    if (pointsError) return pointsError
    if (action.kind !== undefined && !(action.kind in CRIBBAGE_PEG_KIND_LABELS)) {
      return 'Unknown peg kind'
    }
    return null
  },

  applyAction(state, action, ctx) {
    if (action.type === 'undoPeg') {
      return { ...state, pegs: state.pegs.slice(0, -1) }
    }
    if (action.type === 'setDealer') {
      return { ...state, dealerId: action.playerId }
    }
    if (action.type === 'nextDeal') {
      const other = state.playerIds.find((id) => id !== state.dealerId)
      return { ...state, dealerId: other ?? state.playerIds[0]! }
    }

    const peg: CribbagePeg = {
      n: state.pegs.length + 1,
      playerId: action.playerId,
      points: action.points,
      kind: action.kind ?? 'custom',
      recordedBy: ctx.actorId,
      at: ctx.now,
    }
    return { ...state, pegs: [...state.pegs, peg] }
  },

  isFinished(state) {
    return cribbageReachedTarget(state)
  },

  summary(state, players): GameSummary {
    const totals = cribbageTotals(state)
    const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown'
    const sorted = [...state.playerIds].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))
    const first = sorted[0]
    const second = sorted[1]
    const firstScore = first ? (totals[first] ?? 0) : 0
    const secondScore = second ? (totals[second] ?? 0) : 0
    const tied = !!first && !!second && firstScore === secondScore
    const winnerIds = tied ? sorted : first ? [first] : []
    const finished = this.isFinished(state)
    const skunk = finished && cribbageIsSkunk(state)

    let headline = 'Match finished'
    if (first && second) {
      if (tied) {
        headline = `${namesList(winnerIds.map(nameOf))} tie at ${firstScore}`
      } else if (finished) {
        headline = skunk
          ? `${nameOf(first)} skunks ${nameOf(second)} ${firstScore} – ${secondScore}`
          : `${nameOf(first)} wins ${firstScore} – ${secondScore}`
      } else {
        headline = `${nameOf(first)} leads ${firstScore} – ${secondScore}`
      }
    }

    return {
      headline,
      winnerIds,
      entries: sorted.map((playerId, i) => {
        const score = totals[playerId] ?? 0
        const prev = sorted[i - 1]
        const rank = prev && (totals[prev] ?? 0) === score ? i : i + 1
        const skunkNote = finished && skunk && !winnerIds.includes(playerId) ? ' · lurched' : ''
        return {
          playerId,
          rank,
          score,
          scoreText: `${formatPoints(score)}${skunkNote}`,
        }
      }),
    }
  },
}
