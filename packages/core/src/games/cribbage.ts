import type { SessionPlayer } from '../protocol/session-state'
import { formatPoints, namesList, type ActionContext, type GameEngine, type GameSummary } from './types'

/**
 * Cribbage match scoring (Bicycle Cards):
 *
 * - Two or three players each keep their own pegs. Four players play the
 *   standard partnership game: opposite seats in join order (1st with 3rd,
 *   2nd with 4th) share one score. The host can switch that pairing until
 *   the first peg.
 * - Race to a target (default 121; shorter games often play to 61).
 * - Points are pegged as they happen: His Heels, play combinations (15, pairs,
 *   runs, Go, 31), then hand and crib counts.
 * - The game ends as soon as a side reaches the target, mid-hand or after a
 *   count.
 * - If the winner reaches the target before every losing side has crossed the
 *   skunk / lurch line (default halfway: 61 on a 121-point board), the losers
 *   are "lurched" and the win counts as a double game.
 *
 * This engine is a digital pegboard + optional hand calculator — it does not
 * deal cards or enforce the play sequence. Join order is clockwise seat order
 * for the deal and for the opening four-handed partnerships.
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
  /** Person who scored the points. */
  playerId: string
  /**
   * Side the points were pegged on. Missing on pegs saved before partnership
   * games; those count on the scorer's current side.
   */
  sideId?: string
  points: number
  kind: CribbagePegKind
  recordedBy: string
  at: number
}

/** One peg track. A side is a single player, or a four-handed partnership. */
export interface CribbageSide {
  id: string
  playerIds: string[]
}

export interface CribbageState {
  config: CribbageConfig
  /** Clockwise seat order. Also the deal order. */
  playerIds: string[]
  /**
   * Scoring sides. Absent on matches started before four-handed support;
   * each seated player is their own side in that case.
   */
  sides?: CribbageSide[]
  dealerId: string | null
  pegs: CribbagePeg[]
}

export type CribbageAction =
  | { type: 'peg'; playerId: string; points: number; kind?: CribbagePegKind }
  | { type: 'undoPeg' }
  | { type: 'setDealer'; playerId: string }
  | { type: 'nextDeal' }
  | { type: 'cyclePartnerships' }

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

/**
 * Four-handed partnerships, in seat-index pairs. The first matching is
 * opposite seats (standard cribbage). The host can cycle the other two
 * perfect matchings before anyone pegs.
 */
const CRIBBAGE_PAIRINGS: readonly (readonly [number, number])[][] = [
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
]

function initialSides(playerIds: string[]): CribbageSide[] {
  if (playerIds.length === 4) {
    return CRIBBAGE_PAIRINGS[0]!.map((pair) => ({
      id: `side-${playerIds[pair[0]]}`,
      playerIds: pair.map((index) => playerIds[index]!),
    }))
  }
  return playerIds.map((id) => ({ id, playerIds: [id] }))
}

/** Scoring sides, including matches saved before `sides` existed. */
export function cribbageSides(state: CribbageState): CribbageSide[] {
  if (state.sides && state.sides.length > 0) return state.sides
  return state.playerIds.map((id) => ({ id, playerIds: [id] }))
}

export function cribbageSideForPlayer(state: CribbageState, playerId: string): CribbageSide | undefined {
  return cribbageSides(state).find((side) => side.playerIds.includes(playerId))
}

export function cribbageSideLabel(
  side: CribbageSide,
  players: ReadonlyArray<{ id: string; name: string }>,
): string {
  return namesList(side.playerIds.map((id) => players.find((p) => p.id === id)?.name ?? 'Unknown'))
}

function pairingKey(playerIds: string[], groups: ReadonlyArray<readonly number[]>): string {
  return groups
    .map((group) =>
      group
        .map((index) => playerIds[index] ?? '')
        .slice()
        .sort()
        .join('+'),
    )
    .sort()
    .join('|')
}

function currentPairingIndex(state: CribbageState): number {
  const ids = state.playerIds
  const key = cribbageSides(state)
    .map((side) => side.playerIds.slice().sort().join('+'))
    .sort()
    .join('|')
  const index = CRIBBAGE_PAIRINGS.findIndex(
    (pairing) => pairingKey(ids, pairing) === key,
  )
  return index === -1 ? 0 : index
}

function sidesForPairing(state: CribbageState, pairingIndex: number): CribbageSide[] {
  const pairing = CRIBBAGE_PAIRINGS[pairingIndex]!
  const previous = cribbageSides(state)
  return pairing.map((pair, index) => ({
    id: previous[index]?.id ?? `side-${state.playerIds[pair[0]]}`,
    playerIds: pair.map((seat) => state.playerIds[seat]!),
  }))
}

/** Running peg totals, keyed by side id (a player id in two- and three-handed). */
export function cribbageTotals(state: CribbageState): Record<string, number> {
  const sides = cribbageSides(state)
  const totals: Record<string, number> = {}
  for (const side of sides) totals[side.id] = 0
  for (const peg of state.pegs) {
    const mapped = peg.sideId && peg.sideId in totals
      ? peg.sideId
      : cribbageSideForPlayer(state, peg.playerId)?.id ?? peg.playerId
    totals[mapped] = (totals[mapped] ?? 0) + peg.points
  }
  return totals
}

function rankedSides(state: CribbageState): { side: CribbageSide; score: number }[] {
  const totals = cribbageTotals(state)
  return cribbageSides(state)
    .map((side) => ({ side, score: totals[side.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

/** True when the match finished at the target and every losing side is below the skunk line. */
export function cribbageIsSkunk(state: CribbageState): boolean {
  if (!cribbageReachedTarget(state)) return false
  const ranked = rankedSides(state)
  const top = ranked[0]?.score ?? 0
  const losers = ranked.filter((row) => row.score < top)
  if (losers.length === 0) return false
  return losers.every((row) => row.score < state.config.skunkLine)
}

function cribbageReachedTarget(state: CribbageState): boolean {
  const totals = cribbageTotals(state)
  return cribbageSides(state).some((side) => (totals[side.id] ?? 0) >= state.config.targetScore)
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
  tagline: 'Peg to 121 — two-handed, or four-handed partners',
  accentColor: '#86efac',
  minPlayers: 2,
  maxPlayers: 4,
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
      playerIds: ids,
      sides: initialSides(ids),
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
      if (state.playerIds.length === 0) return 'No players seated'
      return null
    }
    if (action.type === 'cyclePartnerships') {
      if (!ctx.isHost) return 'Only the host can switch partners'
      if (state.playerIds.length !== 4) return 'Partnerships are only for four players'
      if (state.pegs.length > 0) return 'Partnerships lock in once someone pegs'
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
      const ids = state.playerIds
      const idx = state.dealerId ? ids.indexOf(state.dealerId) : -1
      const dealerId = ids[(idx + 1) % ids.length] ?? ids[0] ?? null
      return { ...state, dealerId }
    }
    if (action.type === 'cyclePartnerships') {
      const next = (currentPairingIndex(state) + 1) % CRIBBAGE_PAIRINGS.length
      return { ...state, sides: sidesForPairing(state, next) }
    }

    const side = cribbageSideForPlayer(state, action.playerId)
    const peg: CribbagePeg = {
      n: state.pegs.length + 1,
      playerId: action.playerId,
      sideId: side?.id ?? action.playerId,
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
    const labelOf = (side: CribbageSide) => cribbageSideLabel(side, players)
    const ranked = rankedSides(state)
    const first = ranked[0]
    const second = ranked[1]
    const firstScore = first?.score ?? 0
    const winning = first ? ranked.filter((row) => row.score === first.score) : []
    const winnerIds = winning.flatMap((row) => row.side.playerIds)
    const finished = this.isFinished(state)
    const skunk = finished && cribbageIsSkunk(state)
    const scoreLine = ranked.map((row) => row.score).join(' – ')

    let headline = 'Match finished'
    if (first && second) {
      const leader = labelOf(first.side)
      if (winning.length > 1) {
        headline = `${namesList(winning.map((row) => labelOf(row.side)))} tie at ${firstScore}`
      } else if (ranked.length === 2) {
        const trailer = labelOf(second.side)
        if (finished) {
          headline = skunk
            ? `${leader} skunks ${trailer} ${scoreLine}`
            : `${leader} wins ${scoreLine}`
        } else {
          headline = `${leader} leads ${scoreLine}`
        }
      } else if (finished) {
        headline = skunk ? `${leader} skunks ${scoreLine}` : `${leader} wins ${scoreLine}`
      } else {
        headline = `${leader} leads ${scoreLine}`
      }
    }

    const ranks: number[] = []
    for (let i = 0; i < ranked.length; i++) {
      const prev = ranked[i - 1]
      ranks[i] = prev && prev.score === ranked[i]!.score ? ranks[i - 1]! : i + 1
    }

    return {
      headline,
      winnerIds,
      entries: ranked.map((row, i) => {
        const skunkNote =
          finished && skunk && !row.side.playerIds.some((id) => winnerIds.includes(id))
            ? ' · lurched'
            : ''
        const points = `${formatPoints(row.score)}${skunkNote}`
        const partnership = row.side.playerIds.length > 1
        return {
          playerId: row.side.playerIds[0] ?? row.side.id,
          rank: ranks[i]!,
          score: row.score,
          scoreText: partnership ? `${labelOf(row.side)} · ${points}` : points,
        }
      }),
    }
  },
}
