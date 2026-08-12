import type { SessionPhase } from '../protocol/session-state'

/**
 * Host-local lifecycle for a vaulted room. Orthogonal to in-match
 * `SessionPhase` (lobby / playing / finished) and to engine capabilities
 * (rematch, table presence, etc.).
 *
 * Invariants:
 * - `active` means this device intends transport (and Live Activity) up.
 * - At most one vault entry should be `active` per device.
 * - `draft` / `inactive` / `complete` keep transport down.
 */
export type RoomStatus = 'draft' | 'active' | 'inactive' | 'complete'

/** Status to persist when parking a live host (transport goes down). */
export function parkStatusForPhase(phase: SessionPhase): 'draft' | 'inactive' {
  return phase === 'lobby' ? 'draft' : 'inactive'
}

/**
 * Normalize a vault status, including legacy snapshots that predate the field.
 * Legacy never becomes `active` — that would surprise-reopen a relay.
 */
export function normalizeRoomStatus(
  status: RoomStatus | undefined,
  phase: SessionPhase,
): RoomStatus {
  if (status) return status
  if (phase === 'finished') return 'complete'
  if (phase === 'lobby') return 'draft'
  return 'inactive'
}

/** Rooms that still belong on Resume / Continue (not archived history). */
export function isOpenRoomStatus(status: RoomStatus): boolean {
  return status === 'draft' || status === 'active' || status === 'inactive'
}

export function roomStatusLabel(status: RoomStatus): string {
  switch (status) {
    case 'active':
      return 'Live'
    case 'draft':
      return 'Draft'
    case 'inactive':
      return 'Parked'
    case 'complete':
      return 'Ended'
  }
}
