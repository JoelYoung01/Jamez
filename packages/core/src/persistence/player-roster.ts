/**
 * Host-device library of people this host has played with. A player with an
 * empty `clientIds` list was created on the host. A player with one or more
 * ids is bound to those phones; either phone resolves to the same person.
 *
 * Apps persist this under PLAYER_LIBRARY_STORAGE_KEY. PLAYER_ROSTER_STORAGE_KEY
 * is the previous shape (`source: local | remote`) and is migrated on read.
 */

export const PLAYER_LIBRARY_STORAGE_KEY = 'jamez.player-library.v1'
/** Previous roster key. Read once to migrate, then left in place. */
export const PLAYER_ROSTER_STORAGE_KEY = 'jamez.player-roster.v1'

export interface LibraryPlayer {
  /** Stable person id. Seats and scores use this. */
  id: string
  name: string
  emoji: string
  photo?: string
  /**
   * Phones that belong to this person. Empty means the host owns the profile.
   * A later join from any of these ids finds this record.
   */
  clientIds: string[]
  /** Host-only label. Phones never see this; a join does not overwrite it. */
  alias?: string
  /** Hidden from the add-to-game picker. A join from a bound phone clears it. */
  inactive?: boolean
  lastSeenAt: number
}

export type LibraryFieldSource = 'from' | 'to'

/** Which side of a merge supplies each profile field. Defaults to the survivor (`to`). */
export interface LibraryMergeChoices {
  name?: LibraryFieldSource
  emoji?: LibraryFieldSource
  photo?: LibraryFieldSource
  alias?: LibraryFieldSource
}

export interface LibraryUpsert extends Omit<LibraryPlayer, 'lastSeenAt' | 'clientIds' | 'inactive'> {
  clientIds?: string[]
  inactive?: boolean
  lastSeenAt?: number
  /** When true, a join refreshes name/emoji/photo even if the record already has a phone. */
  fromClient?: boolean
}

function cleanName(name: string, fallback: string): string {
  return name.trim().slice(0, 24) || fallback || 'Player'
}

function cleanAlias(alias: string | undefined): string | undefined {
  const trimmed = alias?.trim().slice(0, 24)
  return trimmed ? trimmed : undefined
}

function uniqueIds(ids: string[]): string[] {
  const out: string[] = []
  for (const id of ids) {
    const trimmed = id.trim()
    if (!trimmed || out.includes(trimmed)) continue
    out.push(trimmed)
  }
  return out
}

export function libraryDisplayName(player: Pick<LibraryPlayer, 'name' | 'alias'>): string {
  return player.alias?.trim() || player.name
}

export function libraryPlayerByClientId(
  entries: LibraryPlayer[],
  clientId: string,
): LibraryPlayer | undefined {
  return entries.find((entry) => entry.id === clientId || entry.clientIds.includes(clientId))
}

/** Turn a stored roster or library payload into library entries. */
export function migrateLibraryEntries(raw: unknown): LibraryPlayer[] {
  if (!Array.isArray(raw)) return []
  const entries: LibraryPlayer[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || !row.id) continue
    const clientIds = Array.isArray(row.clientIds)
      ? uniqueIds(row.clientIds.filter((id): id is string => typeof id === 'string'))
      : row.source === 'remote'
        ? [row.id]
        : []
    const photo = typeof row.photo === 'string' && row.photo ? row.photo : undefined
    const alias = typeof row.alias === 'string' ? cleanAlias(row.alias) : undefined
    entries.push({
      id: row.id,
      name: cleanName(typeof row.name === 'string' ? row.name : '', 'Player'),
      emoji: typeof row.emoji === 'string' && row.emoji ? row.emoji : '🙂',
      ...(photo ? { photo } : {}),
      clientIds,
      ...(alias ? { alias } : {}),
      ...(row.inactive === true ? { inactive: true } : {}),
      lastSeenAt:
        typeof row.lastSeenAt === 'number'
          ? row.lastSeenAt
          : typeof row.lastPlayedAt === 'number'
            ? row.lastPlayedAt
            : Date.now(),
    })
  }
  return entries
}

export function upsertLibraryPlayer(entries: LibraryPlayer[], next: LibraryUpsert): LibraryPlayer[] {
  const clientIds = uniqueIds(next.clientIds ?? [])
  const existing =
    entries.find((entry) => entry.id === next.id) ??
    entries.find((entry) => clientIds.some((id) => entry.clientIds.includes(id) || entry.id === id))
  const lastSeenAt = next.lastSeenAt ?? Date.now()
  const mergedIds = uniqueIds([...(existing?.clientIds ?? []), ...clientIds])
  const phoneOwned = mergedIds.length > 0
  const name =
    existing && phoneOwned && !next.fromClient
      ? existing.name
      : cleanName(next.name, existing?.name ?? 'Player')
  const emoji =
    existing && phoneOwned && !next.fromClient
      ? existing.emoji
      : next.emoji || existing?.emoji || '🙂'
  let photo: string | undefined
  if (next.photo !== undefined) {
    photo = next.photo || undefined
  } else {
    photo = existing?.photo
  }
  if (existing && phoneOwned && !next.fromClient && next.photo === undefined) {
    photo = existing.photo
  }
  const alias = next.alias !== undefined ? cleanAlias(next.alias) : existing?.alias
  const inactive = next.inactive !== undefined ? next.inactive : existing?.inactive
  const merged: LibraryPlayer = {
    id: existing?.id ?? next.id,
    name,
    emoji,
    ...(photo ? { photo } : {}),
    clientIds: mergedIds,
    ...(alias ? { alias } : {}),
    ...(inactive ? { inactive: true } : {}),
    lastSeenAt,
  }
  return [merged, ...entries.filter((entry) => entry.id !== merged.id && entry.id !== next.id)]
}

export function setLibraryAlias(
  entries: LibraryPlayer[],
  id: string,
  alias: string,
): LibraryPlayer[] {
  const cleaned = cleanAlias(alias)
  return entries.map((entry) => {
    if (entry.id !== id) return entry
    if (!cleaned) {
      const { alias: _alias, ...rest } = entry
      return rest
    }
    return { ...entry, alias: cleaned }
  })
}

export function setLibraryInactive(
  entries: LibraryPlayer[],
  id: string,
  inactive: boolean,
): LibraryPlayer[] {
  return entries.map((entry) => {
    if (entry.id !== id) return entry
    if (!inactive) {
      const { inactive: _inactive, ...rest } = entry
      return rest
    }
    return { ...entry, inactive: true }
  })
}

function pickField<T>(choice: LibraryFieldSource | undefined, from: T, to: T): T {
  return choice === 'from' ? from : to
}

/**
 * Fold `fromId` into `toId`. Both client id lists survive on the survivor.
 * Returns an error string when the pair cannot be merged.
 */
export function mergeLibraryPlayers(
  entries: LibraryPlayer[],
  fromId: string,
  toId: string,
  choices: LibraryMergeChoices = {},
): { entries: LibraryPlayer[] } | { error: string } {
  if (fromId === toId) return { error: 'Pick two different players' }
  const from = entries.find((entry) => entry.id === fromId)
  const to = entries.find((entry) => entry.id === toId)
  if (!from || !to) return { error: 'Player not found' }
  const photo = pickField(choices.photo, from.photo, to.photo)
  const alias = cleanAlias(pickField(choices.alias, from.alias, to.alias))
  const survivor: LibraryPlayer = {
    id: to.id,
    name: cleanName(pickField(choices.name, from.name, to.name), to.name),
    emoji: pickField(choices.emoji, from.emoji, to.emoji) || to.emoji,
    ...(photo ? { photo } : {}),
    clientIds: uniqueIds([...to.clientIds, ...from.clientIds]),
    ...(alias ? { alias } : {}),
    ...((from.inactive && to.inactive) ? { inactive: true } : {}),
    lastSeenAt: Math.max(from.lastSeenAt, to.lastSeenAt),
  }
  return {
    entries: [survivor, ...entries.filter((entry) => entry.id !== from.id && entry.id !== to.id)],
  }
}

/** Most recently seen first; stable name tie-break. */
export function sortLibraryPlayers(entries: LibraryPlayer[]): LibraryPlayer[] {
  return [...entries].sort((a, b) => {
    if (b.lastSeenAt !== a.lastSeenAt) return b.lastSeenAt - a.lastSeenAt
    return libraryDisplayName(a).localeCompare(libraryDisplayName(b))
  })
}

export function filterLibraryPlayers(
  entries: LibraryPlayer[],
  query: string,
  options?: { includeInactive?: boolean; seatedIds?: Iterable<string> },
): LibraryPlayer[] {
  const needle = query.trim().toLowerCase()
  const seated = new Set(options?.seatedIds ?? [])
  return sortLibraryPlayers(entries).filter((entry) => {
    if (!options?.includeInactive && entry.inactive) return false
    if (seated.has(entry.id)) return false
    if (!needle) return true
    const haystack = `${libraryDisplayName(entry)} ${entry.name}`.toLowerCase()
    return haystack.includes(needle)
  })
}
