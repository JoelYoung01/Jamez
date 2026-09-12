import type { SessionPlayer } from '../protocol/session-state'
import { formatPoints, namesList, type ActionContext, type GameEngine, type GameSummary } from './types'

/**
 * Hand & Foot scoresheet (common Canasta-family house rules):
 *
 * - Seats race to a target (default 10,000) across deals/rounds.
 * - Each round, every seat enters a single integer score (can be negative).
 * - Partnerships use one seat per team; cutthroat uses one seat per player.
 * - The match ends once someone reaches the target and every seat has entered
 *   a score for that final round.
 *
 * Optional calculator (matches the usual book + card tally):
 *   clean×500 + dirty×300 + wild×1500 + redThrees×100
 *   + (100 if went out) + cardPoints − cardsLeft
 */

export interface HandAndFootConfig {
  /** First seat to reach this total wins (common default: 10,000). */
  targetScore: number
}

export interface HandAndFootRound {
  n: number
  /** Missing keys / null mean "not entered yet". */
  scores: Record<string, number | null>
  recordedBy?: string
  at?: number
}

export interface HandAndFootState {
  config: HandAndFootConfig
  playerIds: string[]
  rounds: HandAndFootRound[]
}

export type HandAndFootAction =
  | { type: 'setScore'; playerId: string; roundIndex: number; score: number }
  | { type: 'clearScore'; playerId: string; roundIndex: number }
  | { type: 'addRound' }
  | { type: 'undoRound' }

export const HAND_AND_FOOT_CLEAN_BOOK = 500
export const HAND_AND_FOOT_DIRTY_BOOK = 300
export const HAND_AND_FOOT_WILD_BOOK = 1500
export const HAND_AND_FOOT_RED_THREE = 100
export const HAND_AND_FOOT_GOING_OUT = 100

export interface HandAndFootRoundInput {
  cleanBooks: number
  dirtyBooks: number
  wildBooks: number
  /** Positive for laid red threes; negative when caught in hand/foot. */
  redThrees: number
  wentOut: boolean
  /** Face value of melded cards (including books). */
  cardPoints: number
  /** Face value of cards left in hand/foot (penalty). */
  cardsLeft: number
}

/** Compute a single round score from the usual Hand & Foot tally. */
export function scoreHandAndFootRound(input: HandAndFootRoundInput): number {
  const books =
    input.cleanBooks * HAND_AND_FOOT_CLEAN_BOOK +
    input.dirtyBooks * HAND_AND_FOOT_DIRTY_BOOK +
    input.wildBooks * HAND_AND_FOOT_WILD_BOOK
  const reds = input.redThrees * HAND_AND_FOOT_RED_THREE
  const goingOut = input.wentOut ? HAND_AND_FOOT_GOING_OUT : 0
  return books + reds + goingOut + input.cardPoints - input.cardsLeft
}

/** Running totals across all entered round scores. */
export function handAndFootTotals(state: HandAndFootState): Record<string, number> {
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
export function handAndFootRoundComplete(
  state: HandAndFootState,
  round: HandAndFootRound,
): boolean {
  return state.playerIds.every((id) => typeof round.scores[id] === 'number')
}

function emptyRoundScores(playerIds: string[]): Record<string, number | null> {
  const scores: Record<string, number | null> = {}
  for (const id of playerIds) scores[id] = null
  return scores
}

const MAX_ABS_ROUND = 99_999

function validateRoundScore(score: number): string | null {
  if (!Number.isInteger(score)) return 'Score must be a whole number'
  if (Math.abs(score) > MAX_ABS_ROUND) return 'Score is too large'
  return null
}

export const handAndFootEngine: GameEngine<
  HandAndFootConfig,
  HandAndFootState,
  HandAndFootAction
> = {
  id: 'hand-and-foot',
  name: 'Hand & Foot',
  tagline: 'Meld books racing to 10,000',
  accentColor: '#d4524a',
  minPlayers: 2,
  maxPlayers: 6,
  allowLateJoin: true,

  defaultConfig(): HandAndFootConfig {
    return { targetScore: 10_000 }
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
      if (last && !handAndFootRoundComplete(state, last)) {
        return 'Finish entering scores for the current round first'
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
      if (last && !handAndFootRoundComplete(state, last)) {
        return 'Finish entering scores for the current round first'
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
      const only = state.rounds[0]
      if (!only) return state
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
    const totals = handAndFootTotals(state)
    const reached = state.playerIds.some((id) => (totals[id] ?? 0) >= state.config.targetScore)
    if (!reached) return false
    const last = state.rounds[state.rounds.length - 1]
    return !!last && handAndFootRoundComplete(state, last)
  },

  summary(state, players): GameSummary {
    const totals = handAndFootTotals(state)
    const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown'
    const sorted = [...state.playerIds]
      .map((playerId) => ({ playerId, score: totals[playerId] ?? 0 }))
      .sort((a, b) => b.score - a.score)

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
