/**
 * Host-side session vault helpers.
 *
 * Apps persist authoritative host snapshots locally (localStorage /
 * AsyncStorage). Keys are always scoped by game plugin id so future plugins
 * never overwrite each other's data:
 *
 *   vault root  →  `jamez.host-sessions.v1`
 *   entry key   →  `${gameId}:${CODE}`
 *
 * On iOS, AsyncStorage lives in the app sandbox and is included in standard
 * iCloud/device backups by default. Prefer keeping values JSON-serializable
 * plain objects here so a later CloudKit sync layer can lift them without a
 * schema rewrite.
 */

export const HOST_SESSIONS_VAULT_KEY = 'jamez.host-sessions.v1'

/** Legacy single-snapshot key used before the multi-session vault. */
export const HOST_SESSION_LEGACY_KEY = 'jamez.host-session.v1'

/** Stable map key for one hosted session inside the vault. */
export function hostSessionEntryKey(gameId: string, code: string): string {
  return `${gameId}:${code.trim().toUpperCase()}`
}

export function parseHostSessionEntryKey(
  key: string,
): { gameId: string; code: string } | null {
  const idx = key.indexOf(':')
  if (idx <= 0 || idx === key.length - 1) return null
  return { gameId: key.slice(0, idx), code: key.slice(idx + 1) }
}
