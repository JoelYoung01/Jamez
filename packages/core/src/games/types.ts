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
 * A game engine is a pure, serializable state machine. The host is the only
 * authority: guests submit actions, the host validates and applies them, and
 * the resulting state is broadcast to everyone. Adding a game to Jamez means
 * implementing this interface plus a UI module in each app.
 */
export interface GameEngine<C = unknown, S = unknown, A extends { type: string } = { type: string }> {
  id: string
  name: string
  tagline: string
  emoji: string
  /** Accent used by UIs for chips/headers, as a hex color. */
  accentColor: string
  minPlayers: number
  maxPlayers: number
  /** Can new players join after the game has started? */
  allowLateJoin: boolean
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
}

export function formatPoints(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? 'pt' : 'pts'}`
}

export function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}
