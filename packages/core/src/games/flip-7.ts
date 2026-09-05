import type { SessionPlayer } from '../protocol/session-state'
import { formatPoints, namesList, type ActionContext, type GameEngine, type GameSummary } from './types'

/**
 * Flip 7 scoresheet (matches The Op Games digital score pad at flip7-46611.web.app):
 *
 * - Players race to a target (default 200) across rounds.
 * - Each round, every player enters a single integer score (bust = 0).
 * - Negative round scores are allowed (Vengeance / Brutal Mode).
 * - The match ends once someone reaches the target and every seat has entered
 *   a score for that final round (so same-round ties can resolve to the high score).
 *
 * Official end-of-round math (for the optional calculator helper):
 *   bust → 0
 *   else → (sum of number cards × 2 if x2) + Σ(+N) + (15 if Flip 7)
 */

export interface Flip7Config {
  /** First player to reach this total wins (official default: 200). */
  targetScore: number
}

export interface Flip7Round {
  n: number
  /** Missing keys / null mean "not entered yet". */
  scores: Record<string, number | null>
  recordedBy?: string
  at?: number
}

export interface Flip7State {
  config: Flip7Config
  playerIds: string[]
  rounds: Flip7Round[]
}

export type Flip7Action =
  | { type: 'setScore'; playerId: string; roundIndex: number; score: number }
  | { type: 'clearScore'; playerId: string; roundIndex: number }
  | { type: 'addRound' }
  | { type: 'undoRound' }

/** Number cards in the base game (0–12). */
export const FLIP7_NUMBER_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** Flat +N modifier cards in the base game. */
export const FLIP7_PLUS_MODIFIERS = [2, 4, 6, 8, 10] as const

export const FLIP7_BONUS = 15

export interface Flip7RoundInput {
  /** Unique number-card values held (duplicates would be a bust at the table). */
  numbers: number[]
  /** Flat +N modifiers held. */
  plusModifiers: number[]
  /** Whether the x2 modifier is held. */
  timesTwo: boolean
  /** Seven unique number cards → +15 Flip 7 bonus. */
  flip7: boolean
  /** Bust scores 0 regardless of cards. */
  busted: boolean
}

/**
 * Compute a single round score from cards (official order of operations).
 * x2 doubles number cards only; +N and the Flip 7 bonus are added after.
 */
export function scoreFlip7Round(input: Flip7RoundInput): number {
  if (input.busted) return 0
  const numberSum = input.numbers.reduce((sum, n) => sum + n, 0)
  const doubled = input.timesTwo ? numberSum * 2 : numberSum
  const plus = input.plusModifiers.reduce((sum, n) => sum + n, 0)
  const bonus = input.flip7 ? FLIP7_BONUS : 0
  return doubled + plus + bonus
}

/** Running totals across all entered round scores. */
export function flip7Totals(state: Flip7State): Record<string, number> {
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
export function flip7RoundComplete(state: Flip7State, round: Flip7Round): boolean {
  return state.playerIds.every((id) => typeof round.scores[id] === 'number')
}

function emptyRoundScores(playerIds: string[]): Record<string, number | null> {
  const scores: Record<string, number | null> = {}
  for (const id of playerIds) scores[id] = null
  return scores
}

const MAX_ABS_ROUND = 999

function validateRoundScore(score: number): string | null {
  if (!Number.isInteger(score)) return 'Score must be a whole number'
  if (Math.abs(score) > MAX_ABS_ROUND) return 'Score is too large'
  return null
}

export const flip7Engine: GameEngine<Flip7Config, Flip7State, Flip7Action> = {
  id: 'flip-7',
  name: 'Flip 7',
  tagline: 'Press-your-luck rounds racing to 200',
  accentColor: '#30ced5',
  minPlayers: 3,
  maxPlayers: 8,
  allowLateJoin: true,

  defaultConfig(): Flip7Config {
    return { targetScore: 200 }
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
      if (last && !flip7RoundComplete(state, last)) {
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
    // Allow writing the current round or the next empty one the host opens.
    if (action.roundIndex > state.rounds.length) return 'Invalid round'
    if (action.roundIndex === state.rounds.length) {
      // Creating a brand-new round by writing into it — guests may only write the
      // existing current round; hosts can open the next via setScore too.
      if (!ctx.isHost) return 'Only the host can open a new round'
      const last = state.rounds[state.rounds.length - 1]
      if (last && !flip7RoundComplete(state, last)) {
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
    const totals = flip7Totals(state)
    const reached = state.playerIds.some((id) => (totals[id] ?? 0) >= state.config.targetScore)
    if (!reached) return false
    const last = state.rounds[state.rounds.length - 1]
    return !!last && flip7RoundComplete(state, last)
  },

  summary(state, players): GameSummary {
    const totals = flip7Totals(state)
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
