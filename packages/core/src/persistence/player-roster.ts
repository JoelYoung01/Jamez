/**
 * Device-local roster of people the host has scored with before — both
 * host-created local seats and remote guests who joined past sessions.
 * Apps persist this under PLAYER_ROSTER_STORAGE_KEY; the helpers below stay
 * pure so web (localStorage) and mobile (AsyncStorage) can share them.
 */

export const PLAYER_ROSTER_STORAGE_KEY = 'jamez.player-roster.v1'

export type RosterPlayerSource = 'local' | 'remote'

export interface RosterPlayer {
  /** Stable id reused when re-adding the seat to a session. */
  id: string
  name: string
  emoji: string
  photo?: string
  source: RosterPlayerSource
  lastPlayedAt: number
}

export function upsertRosterPlayer(
  entries: RosterPlayer[],
  next: Omit<RosterPlayer, 'lastPlayedAt'> & { lastPlayedAt?: number },
): RosterPlayer[] {
  const lastPlayedAt = next.lastPlayedAt ?? Date.now()
  const existing = entries.find((e) => e.id === next.id)
  const merged: RosterPlayer = {
    id: next.id,
    name: next.name.trim().slice(0, 24) || existing?.name || 'Player',
    emoji: next.emoji || existing?.emoji || '🙂',
    source: next.source,
    lastPlayedAt,
    ...(next.photo !== undefined
      ? next.photo
        ? { photo: next.photo }
        : {}
      : existing?.photo
        ? { photo: existing.photo }
        : {}),
  }
  // Prefer remote once we've seen a real device under this id.
  if (existing?.source === 'remote' && next.source === 'local') {
    merged.source = 'remote'
  }
  return [merged, ...entries.filter((e) => e.id !== next.id)]
}

export function removeRosterPlayer(entries: RosterPlayer[], id: string): RosterPlayer[] {
  return entries.filter((e) => e.id !== id)
}

/** Most recently played first; stable name tie-break. */
export function sortRosterPlayers(entries: RosterPlayer[]): RosterPlayer[] {
  return [...entries].sort((a, b) => {
    if (b.lastPlayedAt !== a.lastPlayedAt) return b.lastPlayedAt - a.lastPlayedAt
    return a.name.localeCompare(b.name)
  })
}

/** Drop people already seated in the current session. */
export function rosterAvailableForSession(
  entries: RosterPlayer[],
  seatedIds: Iterable<string>,
): RosterPlayer[] {
  const seated = new Set(seatedIds)
  return sortRosterPlayers(entries.filter((e) => !seated.has(e.id)))
}
