import type { SessionPlayer } from '../protocol/session-state'
import { randomId } from '../util/ids'
import { formatPoints, namesList, type ActionContext, type GameEngine, type GameSummary } from './types'

/**
 * Hand & Foot scoresheet with real teams:
 *
 * - Session players are people; the engine groups them into teams of
 *   `playersPerTeam` (1 = cutthroat, 2 = classic partnerships, 3 = trios).
 * - Each round, every **team** enters a single integer score.
 * - The match ends once a team reaches the target and every team has scored
 *   that final round.
 *
 * Optional calculator (usual book + card tally):
 *   clean×500 + dirty×300 + wild×1500 + redThrees×100
 *   + (100 if went out) + cardPoints − cardsLeft
 */

export interface HandAndFootConfig {
  /** First team to reach this total wins (common default: 10,000). */
  targetScore: number
  /**
   * How many people share a score column.
   * 1 = cutthroat, 2 = classic partners, 3 = trios.
   */
  playersPerTeam: number
}

export interface HandAndFootTeam {
  id: string
  /** Optional override; UI falls back to member names. */
  name?: string
  playerIds: string[]
}

export interface HandAndFootRound {
  n: number
  /** Scores keyed by **team** id. Missing / null = not entered yet. */
  scores: Record<string, number | null>
  recordedBy?: string
  at?: number
}

export interface HandAndFootState {
  config: HandAndFootConfig
  teams: HandAndFootTeam[]
  /** Flat list of every person currently in the match (across teams). */
  playerIds: string[]
  rounds: HandAndFootRound[]
}

export type HandAndFootAction =
  | { type: 'setScore'; teamId: string; roundIndex: number; score: number }
  | { type: 'clearScore'; teamId: string; roundIndex: number }
  | { type: 'addRound' }
  | { type: 'undoRound' }
  | { type: 'setTeamName'; teamId: string; name: string }
  | { type: 'movePlayer'; playerId: string; teamId: string }

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
  cardPoints: number
  cardsLeft: number
}

export function scoreHandAndFootRound(input: HandAndFootRoundInput): number {
  const books =
    input.cleanBooks * HAND_AND_FOOT_CLEAN_BOOK +
    input.dirtyBooks * HAND_AND_FOOT_DIRTY_BOOK +
    input.wildBooks * HAND_AND_FOOT_WILD_BOOK
  const reds = input.redThrees * HAND_AND_FOOT_RED_THREE
  const goingOut = input.wentOut ? HAND_AND_FOOT_GOING_OUT : 0
  return books + reds + goingOut + input.cardPoints - input.cardsLeft
}

export function clampPlayersPerTeam(n: number): number {
  if (!Number.isFinite(n)) return 2
  return Math.max(1, Math.min(3, Math.round(n)))
}

/** Partition people into teams of `playersPerTeam` (last team may be short). */
export function buildHandAndFootTeams(
  players: SessionPlayer[],
  playersPerTeam: number,
): HandAndFootTeam[] {
  const size = clampPlayersPerTeam(playersPerTeam)
  if (size === 1) {
    return players.map((p) => ({
      id: `team-${p.id}`,
      playerIds: [p.id],
    }))
  }
  const teams: HandAndFootTeam[] = []
  for (let i = 0; i < players.length; i += size) {
    const members = players.slice(i, i + size)
    teams.push({
      id: `team-${teams.length + 1}-${randomId(3)}`,
      playerIds: members.map((m) => m.id),
    })
  }
  return teams
}

export function teamLabel(
  team: HandAndFootTeam,
  players: SessionPlayer[] | Array<{ id: string; name: string }>,
): string {
  if (team.name?.trim()) return team.name.trim()
  const names = team.playerIds.map(
    (id) => players.find((p) => p.id === id)?.name ?? 'Unknown',
  )
  return namesList(names) || 'Team'
}

/** Running totals keyed by team id. */
export function handAndFootTotals(state: HandAndFootState): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const team of state.teams) totals[team.id] = 0
  for (const round of state.rounds) {
    for (const team of state.teams) {
      const score = round.scores[team.id]
      if (typeof score === 'number') totals[team.id] = (totals[team.id] ?? 0) + score
    }
  }
  return totals
}

export function handAndFootRoundComplete(
  state: HandAndFootState,
  round: HandAndFootRound,
): boolean {
  return state.teams.every((team) => typeof round.scores[team.id] === 'number')
}

export function teamIdForPlayer(state: HandAndFootState, playerId: string): string | undefined {
  return state.teams.find((t) => t.playerIds.includes(playerId))?.id
}

function emptyRoundScores(teamIds: string[]): Record<string, number | null> {
  const scores: Record<string, number | null> = {}
  for (const id of teamIds) scores[id] = null
  return scores
}

function teamIds(state: HandAndFootState): string[] {
  return state.teams.map((t) => t.id)
}

const MAX_ABS_ROUND = 99_999

function validateRoundScore(score: number): string | null {
  if (!Number.isInteger(score)) return 'Score must be a whole number'
  if (Math.abs(score) > MAX_ABS_ROUND) return 'Score is too large'
  return null
}

function findTeam(state: HandAndFootState, teamId: string): HandAndFootTeam | undefined {
  return state.teams.find((t) => t.id === teamId)
}

export const handAndFootEngine: GameEngine<
  HandAndFootConfig,
  HandAndFootState,
  HandAndFootAction
> = {
  id: 'hand-and-foot',
  name: 'Hand & Foot',
  tagline: 'Team book melds racing to 10,000',
  accentColor: '#d4524a',
  minPlayers: 2,
  maxPlayers: 8,
  allowLateJoin: true,

  defaultConfig(): HandAndFootConfig {
    return { targetScore: 10_000, playersPerTeam: 2 }
  },

  init(config, players) {
    const playersPerTeam = clampPlayersPerTeam(config.playersPerTeam)
    const teams = buildHandAndFootTeams(players, playersPerTeam)
    return {
      config: { ...config, playersPerTeam },
      teams,
      playerIds: players.map((p) => p.id),
      rounds: [{ n: 1, scores: emptyRoundScores(teams.map((t) => t.id)) }],
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
        if (!only || state.teams.every((t) => only.scores[t.id] === null)) {
          return 'Nothing to undo'
        }
      }
      return null
    }
    if (action.type === 'setTeamName') {
      if (!ctx.isHost) return 'Only the host can rename teams'
      if (!findTeam(state, action.teamId)) return 'Unknown team'
      if (action.name.trim().length > 24) return 'Team name is too long'
      return null
    }
    if (action.type === 'movePlayer') {
      if (!ctx.isHost) return 'Only the host can move players'
      if (!state.playerIds.includes(action.playerId)) return 'Unknown player'
      if (!findTeam(state, action.teamId)) return 'Unknown team'
      return null
    }

    const team = findTeam(state, action.teamId)
    if (!team) return 'Unknown team'
    const onTeam = team.playerIds.includes(ctx.actorId)
    if (!onTeam && !ctx.isHost) {
      return "You can only edit your own team's score"
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
          { n: state.rounds.length + 1, scores: emptyRoundScores(teamIds(state)), at: ctx.now },
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
        rounds: [{ n: 1, scores: emptyRoundScores(teamIds(state)) }],
      }
    }

    if (action.type === 'setTeamName') {
      const name = action.name.trim().slice(0, 24)
      return {
        ...state,
        teams: state.teams.map((t) =>
          t.id === action.teamId ? { ...t, ...(name ? { name } : { name: undefined }) } : t,
        ),
      }
    }

    if (action.type === 'movePlayer') {
      let teams = state.teams.map((t) => ({
        ...t,
        playerIds: t.playerIds.filter((id) => id !== action.playerId),
      }))
      teams = teams.map((t) =>
        t.id === action.teamId ? { ...t, playerIds: [...t.playerIds, action.playerId] } : t,
      )
      // Drop empty teams and scrub their scores.
      const removed = new Set(teams.filter((t) => t.playerIds.length === 0).map((t) => t.id))
      teams = teams.filter((t) => t.playerIds.length > 0)
      const rounds =
        removed.size === 0
          ? state.rounds
          : state.rounds.map((round) => {
              const scores = { ...round.scores }
              for (const id of removed) delete scores[id]
              return { ...round, scores }
            })
      return { ...state, teams, rounds }
    }

    let rounds = state.rounds
    if (action.roundIndex === rounds.length) {
      rounds = [
        ...rounds,
        {
          n: rounds.length + 1,
          scores: emptyRoundScores(teamIds(state)),
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
      round.scores[action.teamId] = null
    } else {
      round.scores[action.teamId] = action.score
      round.recordedBy = ctx.actorId
      round.at = ctx.now
    }

    return { ...state, rounds }
  },

  isFinished(state) {
    const totals = handAndFootTotals(state)
    const reached = state.teams.some((t) => (totals[t.id] ?? 0) >= state.config.targetScore)
    if (!reached) return false
    const last = state.rounds[state.rounds.length - 1]
    return !!last && handAndFootRoundComplete(state, last)
  },

  summary(state, players): GameSummary {
    const totals = handAndFootTotals(state)
    const sorted = [...state.teams]
      .map((team) => ({ team, score: totals[team.id] ?? 0 }))
      .sort((a, b) => b.score - a.score)

    const first = sorted[0]
    const winningTeams = first ? sorted.filter((s) => s.score === first.score) : []
    // All people on winning teams count as winners (history / "did I win?").
    const winnerIds = winningTeams.flatMap((w) => w.team.playerIds)
    const finished = this.isFinished(state)

    let headline = 'Match finished'
    if (first) {
      const label = teamLabel(first.team, players)
      if (winningTeams.length > 1) {
        headline = `${namesList(winningTeams.map((w) => teamLabel(w.team, players)))} tie at ${formatPoints(first.score)}`
      } else if (finished) {
        headline = `${label} wins with ${formatPoints(first.score)}`
      } else {
        headline = `${label} leads with ${formatPoints(first.score)}`
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
        // Captain id so the shared results list can resolve an avatar.
        playerId: row.team.playerIds[0] ?? row.team.id,
        rank: entriesRank[i]!,
        score: row.score,
        scoreText: `${teamLabel(row.team, players)} · ${formatPoints(row.score)}`,
      })),
    }
  },

  addPlayer(state, player) {
    if (state.playerIds.includes(player.id)) return state
    const team: HandAndFootTeam = {
      id: `team-${player.id}`,
      playerIds: [player.id],
    }
    const teams = [...state.teams, team]
    const rounds = state.rounds.map((round) => ({
      ...round,
      scores: { ...round.scores, [team.id]: null },
    }))
    return {
      ...state,
      teams,
      playerIds: [...state.playerIds, player.id],
      rounds,
    }
  },

  removePlayer(state, playerId) {
    if (!state.playerIds.includes(playerId)) return state
    let teams = state.teams.map((t) => ({
      ...t,
      playerIds: t.playerIds.filter((id) => id !== playerId),
    }))
    const removed = new Set(teams.filter((t) => t.playerIds.length === 0).map((t) => t.id))
    teams = teams.filter((t) => t.playerIds.length > 0)
    const rounds = state.rounds.map((round) => {
      const scores = { ...round.scores }
      for (const id of removed) delete scores[id]
      return { ...round, scores }
    })
    return {
      ...state,
      teams,
      playerIds: state.playerIds.filter((id) => id !== playerId),
      rounds,
    }
  },
}
