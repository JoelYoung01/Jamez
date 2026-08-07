import type { SessionPlayer } from '../protocol/session-state'

export interface ActionContext {
  actorId: string
  isHost: boolean
  now: number
}

export interface SummaryEntry {
  playerId: string
  /** Competition ranking: tied players share a rank (1, 1, 3, ...). */
  rank: number
  score: number
  scoreText: string
}

export interface GameSummary {
  headline: string
  winnerIds: string[]
  entries: SummaryEntry[]
}

/**
 * How a game uses the host session lifecycle.
 *
 * - `match` (default): finite game night with finish / rematch / history.
 * - `ongoing`: long-lived room (banks, leagues, seasons). Host may park and
 *   resume across days; game state is persisted under a game-scoped key.
 */
export type GameSessionMode = 'match' | 'ongoing'

/**
 * A game engine is a pure, serializable state machine. The host is the only
 * authority: guests submit actions, the host validates and applies them, and
 * the resulting state is broadcast to everyone. Adding a game to Jamez means
 * implementing this interface plus a UI module in each app.
 *
 * Engines own only the contents of `SessionState.game`. Host apps persist
 * full session snapshots under keys scoped by `engine.id` (see host-session
 * vault helpers) so plugins never collide with each other.
 */
export interface GameEngine<C = unknown, S = unknown, A extends { type: string } = { type: string }> {
  id: string
  name: string
  tagline: string
  /** Accent used by UIs for chips/headers, as a hex color. */
  accentColor: string
  minPlayers: number
  maxPlayers: number
  /** Can new players join after the game has started? */
  allowLateJoin: boolean
  /**
   * Session lifecycle mode. Omit or `'match'` for normal finite games.
   * Use `'ongoing'` for banks / leagues that outlive a single night.
   */
  sessionMode?: GameSessionMode
  defaultConfig(): C
  init(config: C, players: SessionPlayer[]): S
  /** Returns an error message, or null when the action is allowed. */
  validateAction(state: S, action: A, ctx: ActionContext): string | null
  applyAction(state: S, action: A, ctx: ActionContext): S
  /** When true after an action, the session finishes automatically. */
  isFinished(state: S): boolean
  summary(state: S, players: SessionPlayer[]): GameSummary
  addPlayer?(state: S, player: SessionPlayer): S
  removePlayer?(state: S, playerId: string): S
  /**
   * Claimer takes over a seat's game resources (replacing the claimer's).
   * Used when a remote player claims a host-created guest seat.
   */
  claimSeat?(state: S, seatId: string, claimerId: string): S
  /**
   * Merge `fromId`'s game resources into `toId`, then drop `fromId`.
   * Used for consolidating duplicate seats / accounts.
   */
  mergePlayers?(state: S, fromId: string, toId: string): S
}

/** True when the engine is a long-lived room rather than a finite match. */
export function isOngoingGame(game: Pick<GameEngine, 'sessionMode'>): boolean {
  return game.sessionMode === 'ongoing'
}

export function formatPoints(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? 'pt' : 'pts'}`
}

export function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
