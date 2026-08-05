import type { SessionPlayer } from '../protocol/session-state'
import { namesList, type ActionContext, type GameEngine, type GameSummary } from './types'

/**
 * Gin Rummy match scoring (standard rules, all bonuses configurable):
 *
 * - Knock: knocker scores the deadwood difference when theirs is lower.
 * - Undercut: if the defender's deadwood is equal or lower, the defender
 *   scores the difference plus the undercut bonus (default 25).
 * - Gin: 0 deadwood -> gin bonus (default 25) + opponent's deadwood.
 * - Big gin: all 11 cards melded -> big gin bonus (default 31) + opponent's
 *   deadwood.
 * - Match ends when a player reaches the target (default 100). The winner
 *   gets the game bonus (default 100, doubled on a shutout), and each player
 *   adds the line/box bonus (default 25) per hand won.
 */

export interface GinConfig {
  targetScore: number
  ginBonus: number
  bigGinBonus: number
  undercutBonus: number
  lineBonus: number
  gameBonus: number
  shutoutDoublesGameBonus: boolean
}

export type GinOutcome = 'knock' | 'gin' | 'bigGin'

export interface GinHand {
  n: number
  knockerId: string
  outcome: GinOutcome
  knockerDeadwood: number
  defenderDeadwood: number
  /** Derived when the hand is recorded. */
  winnerId: string
  points: number
  undercut: boolean
  recordedBy: string
  at: number
}

export interface GinState {
  config: GinConfig
  playerIds: [string, string]
  dealerId: string | null
  hands: GinHand[]
}

export type GinAction =
  | {
      type: 'recordHand'
      knockerId: string
      outcome: GinOutcome
      knockerDeadwood: number
      defenderDeadwood: number
    }
  | { type: 'undoHand' }
  | { type: 'setDealer'; playerId: string }

export interface GinHandScore {
  winnerId: string
  points: number
  undercut: boolean
}

export function scoreGinHand(
  config: GinConfig,
  input: {
    knockerId: string
    defenderId: string
    outcome: GinOutcome
    knockerDeadwood: number
    defenderDeadwood: number
  },
): GinHandScore {
  const { knockerId, defenderId, outcome, knockerDeadwood, defenderDeadwood } = input
  if (outcome === 'gin') {
    return { winnerId: knockerId, points: defenderDeadwood + config.ginBonus, undercut: false }
  }
  if (outcome === 'bigGin') {
    return { winnerId: knockerId, points: defenderDeadwood + config.bigGinBonus, undercut: false }
  }
  // Knock: an equal-or-lower defender count is an undercut.
  if (defenderDeadwood > knockerDeadwood) {
    return { winnerId: knockerId, points: defenderDeadwood - knockerDeadwood, undercut: false }
  }
  return {
    winnerId: defenderId,
    points: knockerDeadwood - defenderDeadwood + config.undercutBonus,
    undercut: true,
  }
}

/** Running hand-point totals (no end-of-match bonuses). */
export function ginTotals(state: GinState): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const id of state.playerIds) totals[id] = 0
  for (const hand of state.hands) {
    totals[hand.winnerId] = (totals[hand.winnerId] ?? 0) + hand.points
  }
  return totals
}

/** Hands won per player ("boxes"). */
export function ginBoxes(state: GinState): Record<string, number> {
  const boxes: Record<string, number> = {}
  for (const id of state.playerIds) boxes[id] = 0
  for (const hand of state.hands) {
    boxes[hand.winnerId] = (boxes[hand.winnerId] ?? 0) + 1
  }
  return boxes
}

export interface GinFinalLine {
  playerId: string
  handPoints: number
  boxes: number
  lineBonusTotal: number
  gameBonus: number
  finalScore: number
}

/**
 * Final tally. If the match is ended early (target not reached) line bonuses
 * still apply but no game bonus is awarded.
 */
export function ginFinalTally(state: GinState): GinFinalLine[] {
  const totals = ginTotals(state)
  const boxes = ginBoxes(state)
  const [a, b] = state.playerIds
  const reached = state.playerIds.some((id) => (totals[id] ?? 0) >= state.config.targetScore)
  const leaderId = (totals[a] ?? 0) >= (totals[b] ?? 0) ? a : b

  return state.playerIds.map((playerId) => {
    const handPoints = totals[playerId] ?? 0
    const wonBoxes = boxes[playerId] ?? 0
    let gameBonus = 0
    if (reached && playerId === leaderId) {
      const opponentId = playerId === a ? b : a
      const shutout = (totals[opponentId] ?? 0) === 0
      gameBonus =
        shutout && state.config.shutoutDoublesGameBonus
          ? state.config.gameBonus * 2
          : state.config.gameBonus
    }
    const lineBonusTotal = wonBoxes * state.config.lineBonus
    return {
      playerId,
      handPoints,
      boxes: wonBoxes,
      lineBonusTotal,
      gameBonus,
      finalScore: handPoints + lineBonusTotal + gameBonus,
    }
  })
}

const MAX_DEADWOOD = 98 // theoretical ceiling for ten unmatched cards

export const ginRummyEngine: GameEngine<GinConfig, GinState, GinAction> = {
  id: 'gin-rummy',
  name: 'Gin Rummy',
  tagline: 'Knocks, undercuts and boxes, tallied for you',
  accentColor: '#fb7185',
  minPlayers: 2,
  maxPlayers: 2,
  allowLateJoin: false,

  defaultConfig(): GinConfig {
    return {
      targetScore: 100,
      ginBonus: 25,
      bigGinBonus: 31,
      undercutBonus: 25,
      lineBonus: 25,
      gameBonus: 100,
      shutoutDoublesGameBonus: true,
    }
  },

  init(config, players) {
    const ids = players.map((p) => p.id)
    return {
      config,
      playerIds: [ids[0]!, ids[1]!],
      dealerId: ids[0] ?? null,
      hands: [],
    }
  },

  validateAction(state, action, ctx: ActionContext) {
    if (action.type === 'undoHand') {
      if (!ctx.isHost) return 'Only the host can undo a hand'
      if (state.hands.length === 0) return 'No hands to undo'
      return null
    }
    if (action.type === 'setDealer') {
      if (!ctx.isHost) return 'Only the host can set the dealer'
      if (!state.playerIds.includes(action.playerId)) return 'Unknown player'
      return null
    }
    if (!state.playerIds.includes(action.knockerId)) return 'Unknown player'
    const { outcome, knockerDeadwood, defenderDeadwood } = action
    if (!Number.isInteger(knockerDeadwood) || !Number.isInteger(defenderDeadwood)) {
      return 'Deadwood must be a whole number'
    }
    if (knockerDeadwood < 0 || defenderDeadwood < 0) return 'Deadwood cannot be negative'
    if (knockerDeadwood > MAX_DEADWOOD || defenderDeadwood > MAX_DEADWOOD) {
      return 'Deadwood is too large'
    }
    if (outcome === 'knock') {
      if (knockerDeadwood === 0) return 'A knock with 0 deadwood is gin. Pick Gin instead.'
      if (knockerDeadwood > 10) return 'You can only knock with 10 or less deadwood'
    } else if (knockerDeadwood !== 0) {
      return 'Gin means zero deadwood for the knocker'
    }
    return null
  },

  applyAction(state, action, ctx) {
    if (action.type === 'undoHand') {
      const hands = state.hands.slice(0, -1)
      const lastHand = hands[hands.length - 1]
      return {
        ...state,
        hands,
        // Restore dealer to "loser of the (new) last hand deals next".
        dealerId: lastHand ? loserOf(state, lastHand) : state.dealerId,
      }
    }
    if (action.type === 'setDealer') {
      return { ...state, dealerId: action.playerId }
    }
    const defenderId = state.playerIds.find((id) => id !== action.knockerId)!
    const score = scoreGinHand(state.config, {
      knockerId: action.knockerId,
      defenderId,
      outcome: action.outcome,
      knockerDeadwood: action.knockerDeadwood,
      defenderDeadwood: action.defenderDeadwood,
    })
    const hand: GinHand = {
      n: state.hands.length + 1,
      knockerId: action.knockerId,
      outcome: action.outcome,
      knockerDeadwood: action.knockerDeadwood,
      defenderDeadwood: action.defenderDeadwood,
      winnerId: score.winnerId,
      points: score.points,
      undercut: score.undercut,
      recordedBy: ctx.actorId,
      at: ctx.now,
    }
    return {
      ...state,
      hands: [...state.hands, hand],
      // Classic table rule: the loser of a hand deals the next one.
      dealerId: score.winnerId === action.knockerId ? defenderId : action.knockerId,
    }
  },

  isFinished(state) {
    const totals = ginTotals(state)
    return state.playerIds.some((id) => (totals[id] ?? 0) >= state.config.targetScore)
  },

  summary(state, players): GameSummary {
    const tally = ginFinalTally(state)
    const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown'
    const sorted = [...tally].sort((a, b) => b.finalScore - a.finalScore)
    const first = sorted[0]
    const second = sorted[1]
    const tied = !!first && !!second && first.finalScore === second.finalScore
    const winnerIds = tied ? sorted.map((t) => t.playerId) : first ? [first.playerId] : []
    const finished = this.isFinished(state)
    let headline = 'Match finished'
    if (first && second) {
      headline = tied
        ? `${namesList(winnerIds.map(nameOf))} tie at ${first.finalScore}`
        : finished
          ? `${nameOf(first.playerId)} wins the match ${first.finalScore} – ${second.finalScore}`
          : `${nameOf(first.playerId)} leads ${first.finalScore} – ${second.finalScore}`
    }
    return {
      headline,
      winnerIds,
      entries: sorted.map((t, i) => {
        const prev = sorted[i - 1]
        const rank = prev && prev.finalScore === t.finalScore ? i : i + 1
        return {
          playerId: t.playerId,
          rank,
          score: t.finalScore,
          scoreText: `${t.finalScore} pts · ${t.boxes} ${t.boxes === 1 ? 'hand' : 'hands'} won`,
        }
      }),
    }
  },
}

function loserOf(state: GinState, hand: GinHand): string {
  return state.playerIds.find((id) => id !== hand.winnerId) ?? hand.winnerId
}
