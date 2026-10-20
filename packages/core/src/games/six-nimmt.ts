import type { SessionPlayer } from '../protocol/session-state'
import { formatPoints, namesList, type ActionContext, type GameEngine, type GameSummary } from './types'

/**
 * 6 nimmt! (Amigo / Wolfgang Kramer) scoresheet.
 *
 * Bullheads on cards 1–104:
 *   55 → 7
 *   doublets (11, 22, 33, 44, 66, 77, 88, 99) → 5
 *   multiples of 10 → 3
 *   numbers ending in 5 (except 55) → 2
 *   every other card → 1
 *
 * Each round every player records the bullheads in the rows they took.
 * After a completed round, if anyone has 66 or more (or a house target),
 * the match ends. Fewest bullheads wins; a tie for fewest shares the win.
 */

export const SIX_NIMMT_DECK_MIN = 1
export const SIX_NIMMT_DECK_MAX = 104
export const SIX_NIMMT_DEFAULT_TARGET = 66

export interface SixNimmtConfig {
  /** End after a round in which any total reaches this. Official default: 66. */
  targetScore: number
}

export interface SixNimmtRound {
  n: number
  /** Missing keys / null mean "not entered yet". */
  scores: Record<string, number | null>
  recordedBy?: string
  at?: number
}

export interface SixNimmtState {
  config: SixNimmtConfig
  playerIds: string[]
  rounds: SixNimmtRound[]
}

export type SixNimmtAction =
  | { type: 'setScore'; playerId: string; roundIndex: number; score: number }
  | { type: 'clearScore'; playerId: string; roundIndex: number }
  | { type: 'addRound' }
  | { type: 'undoRound' }

/** Bullheads printed on card `n`, or null when `n` is outside the 1–104 deck. */
export function bullheadsOnCard(n: number): number | null {
  if (!Number.isInteger(n) || n < SIX_NIMMT_DECK_MIN || n > SIX_NIMMT_DECK_MAX) return null
  if (n === 55) return 7
  if (n % 11 === 0) return 5
  if (n % 10 === 0) return 3
  if (n % 10 === 5) return 2
  return 1
}

/** Sum bullheads for a pile. Cards outside 1–104 are ignored. */
export function sumBullheads(cards: readonly number[]): number {
  let total = 0
  for (const card of cards) {
    const heads = bullheadsOnCard(card)
    if (heads !== null) total += heads
  }
  return total
}

/** Running bullhead totals across entered round scores. */
export function sixNimmtTotals(state: SixNimmtState): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const id of state.playerIds) totals[id] = 0
  for (const round of state.rounds) {
    for (const id of state.playerIds) {
      const score = round.scores[id]
      if (typeof score === 'number') totals[id] = (totals[id] ?? 0) + score
    }
  }
  return totals
}

/** True when every seated player has entered a numeric score for the round. */
export function sixNimmtRoundComplete(state: SixNimmtState, round: SixNimmtRound): boolean {
  return state.playerIds.every((id) => typeof round.scores[id] === 'number')
}

function emptyRoundScores(playerIds: string[]): Record<string, number | null> {
  const scores: Record<string, number | null> = {}
  for (const id of playerIds) scores[id] = null
  return scores
}

const MAX_ROUND = 999

function validateRoundScore(score: number): string | null {
  if (!Number.isInteger(score)) return 'Bullheads must be a whole number'
  if (score < 0 || score > MAX_ROUND) return 'Bullheads must be from 0 to 999'
  return null
}

export const sixNimmtEngine: GameEngine<SixNimmtConfig, SixNimmtState, SixNimmtAction> = {
  id: 'six-nimmt',
  name: '6 nimmt!',
  tagline: 'Avoid bullheads — fewest points wins at 66',
  accentColor: '#e8a317',
  minPlayers: 2,
  maxPlayers: 10,
  allowLateJoin: true,

  defaultConfig(): SixNimmtConfig {
    return { targetScore: SIX_NIMMT_DEFAULT_TARGET }
  },

  init(config, players) {
    return {
      config,
      playerIds: players.map((p) => p.id),
      rounds: [{ n: 1, scores: emptyRoundScores(players.map((p) => p.id)) }],
    }
  },

  validateAction(state, action, ctx: ActionContext) {
    if (action.type === 'addRound') {
      if (!ctx.isHost) return 'Only the host can start a new round'
      const last = state.rounds[state.rounds.length - 1]
      if (last && !sixNimmtRoundComplete(state, last)) {
        return 'Finish entering bullheads for the current round first'
      }
      return null
    }
    if (action.type === 'undoRound') {
      if (!ctx.isHost) return 'Only the host can undo a round'
      if (state.rounds.length <= 1) {
        const only = state.rounds[0]
        if (!only || state.playerIds.every((id) => only.scores[id] === null)) {
          return 'Nothing to undo'
        }
      }
      return null
    }

    if (!state.playerIds.includes(action.playerId)) return 'Unknown player'
    if (action.playerId !== ctx.actorId && !ctx.isHost) {
      return 'You can only edit your own score'
    }
    if (!Number.isInteger(action.roundIndex) || action.roundIndex < 0) {
      return 'Invalid round'
    }
    if (action.roundIndex > state.rounds.length) return 'Invalid round'
    if (action.roundIndex === state.rounds.length) {
      if (!ctx.isHost) return 'Only the host can open a new round'
      const last = state.rounds[state.rounds.length - 1]
      if (last && !sixNimmtRoundComplete(state, last)) {
        return 'Finish entering bullheads for the current round first'
      }
    }

    if (action.type === 'setScore') return validateRoundScore(action.score)
    return null
  },

  applyAction(state, action, ctx) {
    if (action.type === 'addRound') {
      return {
        ...state,
        rounds: [
          ...state.rounds,
          { n: state.rounds.length + 1, scores: emptyRoundScores(state.playerIds), at: ctx.now },
        ],
      }
    }

    if (action.type === 'undoRound') {
      if (state.rounds.length > 1) {
        return { ...state, rounds: state.rounds.slice(0, -1) }
      }
      return {
        ...state,
        rounds: [{ n: 1, scores: emptyRoundScores(state.playerIds) }],
      }
    }

    let rounds = state.rounds
    if (action.roundIndex === rounds.length) {
      rounds = [
        ...rounds,
        {
          n: rounds.length + 1,
          scores: emptyRoundScores(state.playerIds),
          recordedBy: ctx.actorId,
          at: ctx.now,
        },
      ]
    } else {
      rounds = rounds.map((r) => ({ ...r, scores: { ...r.scores } }))
    }

    const round = rounds[action.roundIndex]
    if (!round) return state

    if (action.type === 'clearScore') {
      round.scores[action.playerId] = null
    } else {
      round.scores[action.playerId] = action.score
      round.recordedBy = ctx.actorId
      round.at = ctx.now
    }

    return { ...state, rounds }
  },

  isFinished(state) {
    const totals = sixNimmtTotals(state)
    const target = state.config.targetScore
    const reached = state.playerIds.some((id) => (totals[id] ?? 0) >= target)
    if (!reached) return false
    const last = state.rounds[state.rounds.length - 1]
    return !!last && sixNimmtRoundComplete(state, last)
  },

  summary(state, players): GameSummary {
    const totals = sixNimmtTotals(state)
    const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown'
    const sorted = [...state.playerIds]
      .map((playerId) => ({ playerId, score: totals[playerId] ?? 0 }))
      .sort((a, b) => a.score - b.score || a.playerId.localeCompare(b.playerId))

    const first = sorted[0]
    const winners = first ? sorted.filter((s) => s.score === first.score) : []
    const winnerIds = winners.map((w) => w.playerId)
    const finished = this.isFinished(state)

    let headline = 'Match finished'
    if (first) {
      if (winners.length > 1) {
        headline = `${namesList(winnerIds.map(nameOf))} tie at ${formatPoints(first.score)}`
      } else if (finished) {
        headline = `${nameOf(first.playerId)} wins with ${formatPoints(first.score)}`
      } else {
        headline = `${nameOf(first.playerId)} leads with ${formatPoints(first.score)}`
      }
    }

    const entriesRank: number[] = []
    for (let i = 0; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const row = sorted[i]!
      entriesRank[i] = prev && prev.score === row.score ? entriesRank[i - 1]! : i + 1
    }

    return {
      headline,
      winnerIds,
      entries: sorted.map((row, i) => ({
        playerId: row.playerId,
        rank: entriesRank[i]!,
        score: row.score,
        scoreText: formatPoints(row.score),
      })),
    }
  },

  addPlayer(state, player) {
    if (state.playerIds.includes(player.id)) return state
    const playerIds = [...state.playerIds, player.id]
    const rounds = state.rounds.map((round) => ({
      ...round,
      scores: { ...round.scores, [player.id]: null },
    }))
    return { ...state, playerIds, rounds }
  },

  mergePlayers(state, fromId, toId, mode) {
    if (!state.playerIds.includes(fromId)) return state
    const playerIds = state.playerIds.filter((id) => id !== fromId)
    if (!playerIds.includes(toId)) playerIds.push(toId)
    const rounds = state.rounds.map((round) => {
      const scores = { ...round.scores }
      const fromScore = scores[fromId]
      const toScore = scores[toId]
      if (mode === 'combine') {
        if (fromScore == null && toScore == null) scores[toId] = null
        else scores[toId] = (fromScore ?? 0) + (toScore ?? 0)
      }
      delete scores[fromId]
      return { ...round, scores }
    })
    return { ...state, playerIds, rounds }
  },

  removePlayer(state, playerId) {
    if (!state.playerIds.includes(playerId)) return state
    const playerIds = state.playerIds.filter((id) => id !== playerId)
    const rounds = state.rounds.map((round) => {
      const scores = { ...round.scores }
      delete scores[playerId]
      return { ...round, scores }
    })
    return { ...state, playerIds, rounds }
  },
}
