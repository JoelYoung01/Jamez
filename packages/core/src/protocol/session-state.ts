import type { GameSummary } from '../games/types'

export type SessionPhase = 'lobby' | 'playing' | 'finished'

export const SESSION_NICKNAME_MAX = 32

/** Trim and clamp a nickname; empty/whitespace clears it. */
export function normalizeNickname(raw: string | undefined | null): string | undefined {
  const t = (raw ?? '').trim().slice(0, SESSION_NICKNAME_MAX)
  return t.length > 0 ? t : undefined
}

export interface PlayerProfile {
  /** Stable per-device identity so reconnects reclaim the same seat. */
  id: string
  name: string
  emoji: string
  /**
   * Optional tiny data-URL avatar (`image/webp` or `image/jpeg`). Carried on
   * hello / dedicated avatar messages — not every state broadcast.
   */
  photo?: string
}

export interface SessionPlayer extends PlayerProfile {
  color: string
  isHost: boolean
  /**
   * Phones that may act as this seat. Empty means the host created the player
   * and plays the seat. A seat id can differ from these ids after a merge.
   */
  clientIds: string[]
  connected: boolean
  joinedAt: number
  /**
   * Whether this player is at the table for the current sitting of the session.
   * Orthogonal to `connected` (on the wire right now): closing the app must not
   * flip this. Explicit join / host check-in sets it true; explicit leave /
   * host “not present” sets it false. Omitted / undefined means at the table
   * (back-compat with older snapshots).
   */
  active?: boolean
  /**
   * True when this player has a profile photo. Photo bytes are stripped from
   * state broadcasts; peers use this flag to request or clear cached avatars.
   */
  hasPhoto?: boolean
}

/** At the table unless explicitly marked not present (`active: false`). */
export function isPlayerActive(player: Pick<SessionPlayer, 'active'>): boolean {
  return player.active !== false
}

/** A non-host seat with at least one bound phone. */
export function hasPhoneClient(player: Pick<SessionPlayer, 'isHost' | 'clientIds'>): boolean {
  return !player.isHost && player.clientIds.length > 0
}

/** Seat whose id or bound phones match this device. */
export function seatForClientId(
  players: readonly SessionPlayer[],
  clientId: string,
): SessionPlayer | undefined {
  return players.find((player) => player.id === clientId || player.clientIds.includes(clientId))
}

type LegacySessionPlayer = SessionPlayer & { remote?: boolean; clientIds?: string[] }

/** Fill `clientIds` for snapshots saved before phone binding lived on the seat. */
export function normalizeSessionPlayer(raw: LegacySessionPlayer): SessionPlayer {
  const clientIds = Array.isArray(raw.clientIds)
    ? raw.clientIds.filter((id) => typeof id === 'string' && id.length > 0)
    : raw.remote
      ? [raw.id]
      : []
  const { remote: _remote, ...rest } = raw
  return { ...rest, clientIds }
}

export interface SessionState<GS = unknown> {
  v: 1
  /** Changes per match (a rematch starts a new sessionId with the same code). */
  sessionId: string
  code: string
  gameId: string
  gameConfig: unknown
  phase: SessionPhase
  /** Monotonic revision; guests use it to detect missed updates. */
  rev: number
  players: SessionPlayer[]
  game: GS | null
  createdAt: number
  startedAt?: number
  finishedAt?: number
  summary?: GameSummary
  /** Optional host-set label (e.g. "Friday night bank"). Empty/undefined = no nickname. */
  nickname?: string
}

export const PLAYER_COLORS = [
  '#fbbf24', // amber
  '#34d399', // emerald
  '#60a5fa', // blue
  '#f472b6', // pink
  '#a78bfa', // violet
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#f87171', // red
]

export function pickPlayerColor(taken: string[]): string {
  for (const color of PLAYER_COLORS) {
    if (!taken.includes(color)) return color
  }
  return PLAYER_COLORS[taken.length % PLAYER_COLORS.length]!
}

// ---------------------------------------------------------------------------
// Wire protocol. Every message is wrapped in an envelope, then end-to-end
// encrypted by the transport layer before it leaves the device.
// ---------------------------------------------------------------------------

export type WireMessage =
  | { t: 'hello'; player: PlayerProfile }
  | { t: 'bye'; playerId: string }
  | { t: 'hb'; playerId: string; rev: number }
  | { t: 'action'; playerId: string; reqId: string; action: { type: string } & Record<string, unknown> }
  | { t: 'sync'; playerId: string }
  | { t: 'state'; state: SessionState }
  | { t: 'ping'; rev: number }
  | { t: 'reject'; to: string; reqId?: string; reason: string }
  | { t: 'ended' }
  /** Drop a phone off this seat. The seat itself stays until the host removes it. */
  | { t: 'kick'; to: string }
  /** One-shot "add me to your player library" while the host's enroll screen is open. */
  | { t: 'enroll'; player: PlayerProfile }
  | { t: 'enrolled'; to: string; name: string }
  /** Fan-out a player's tiny avatar once (or on change). */
  | { t: 'avatar'; playerId: string; photo: string }
  /** Ask the host to (re)send avatar bytes for the given players (or all). */
  | { t: 'avatar-req'; playerIds?: string[] }

export interface Envelope {
  jamez: 1
  sid: string
  from: string
  msg: WireMessage
}

export function makeEnvelope(sid: string, from: string, msg: WireMessage): Envelope {
  return { jamez: 1, sid, from, msg }
}

export function parseEnvelope(payload: unknown, sid: string): Envelope | null {
  if (!payload || typeof payload !== 'object') return null
  const env = payload as Partial<Envelope>
  if (env.jamez !== 1 || env.sid !== sid || !env.msg || typeof env.msg !== 'object') return null
  if (typeof env.from !== 'string') return null
  return env as Envelope
}
