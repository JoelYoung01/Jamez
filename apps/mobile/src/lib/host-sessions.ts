import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  HOST_SESSION_LEGACY_KEY,
  HOST_SESSIONS_VAULT_KEY,
  getGameEngine,
  hostSessionEntryKey,
  isOngoingGame,
  type SessionState,
} from '@jamez/core'

/**
 * Host session vault (AsyncStorage).
 *
 * Values are plain JSON under `jamez.host-sessions.v1`, keyed by
 * `${gameId}:${CODE}`. On iOS, AsyncStorage lives in the app sandbox and is
 * included in standard device/iCloud backups — good enough to restore a lost
 * phone from backup. Dedicated CloudKit sync is intentionally deferred; keep
 * this shape JSON-serializable so that migration stays easy.
 */

export interface HostSnapshot {
  state: SessionState
  passAndPlay: boolean
  savedAt: number
}

type Vault = Record<string, HostSnapshot>

async function readVaultRaw(): Promise<Vault> {
  try {
    const raw = await AsyncStorage.getItem(HOST_SESSIONS_VAULT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Vault
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {
    // fall through
  }
  return migrateLegacy()
}

async function migrateLegacy(): Promise<Vault> {
  try {
    const raw = await AsyncStorage.getItem(HOST_SESSION_LEGACY_KEY)
    if (!raw) return {}
    const snap = JSON.parse(raw) as HostSnapshot
    if (!snap?.state?.code || !snap.state.gameId) return {}
    const vault: Vault = {
      [hostSessionEntryKey(snap.state.gameId, snap.state.code)]: snap,
    }
    await AsyncStorage.setItem(HOST_SESSIONS_VAULT_KEY, JSON.stringify(vault))
    await AsyncStorage.removeItem(HOST_SESSION_LEGACY_KEY)
    return vault
  } catch {
    return {}
  }
}

async function writeVault(vault: Vault): Promise<void> {
  try {
    await AsyncStorage.setItem(HOST_SESSIONS_VAULT_KEY, JSON.stringify(vault))
  } catch {
    // non-fatal
  }
}

export function persistHostSnapshot(state: SessionState, passAndPlay: boolean): void {
  const snapshot: HostSnapshot = { state, passAndPlay, savedAt: Date.now() }
  void readVaultRaw()
    .then((vault) => {
      vault[hostSessionEntryKey(state.gameId, state.code)] = snapshot
      return writeVault(vault)
    })
    .catch(() => {})
}

export async function readHostSnapshot(code?: string): Promise<HostSnapshot | null> {
  const vault = await readVaultRaw()
  if (code) {
    const upper = code.toUpperCase()
    for (const snap of Object.values(vault)) {
      if (snap.state.code === upper) return snap
    }
    return null
  }
  const snaps = Object.values(vault)
  if (snaps.length === 0) return null
  const playing = snaps.find((s) => s.state.phase !== 'finished')
  return (playing ?? snaps.sort((a, b) => b.savedAt - a.savedAt)[0]) ?? null
}

export async function listHostSnapshots(): Promise<HostSnapshot[]> {
  const vault = await readVaultRaw()
  return Object.values(vault).sort((a, b) => b.savedAt - a.savedAt)
}

export async function listResumableHostSnapshots(): Promise<HostSnapshot[]> {
  const snaps = await listHostSnapshots()
  return snaps.filter((snap) => {
    const engine = getGameEngine(snap.state.gameId)
    if (!engine) return snap.state.phase !== 'finished'
    if (isOngoingGame(engine)) return snap.state.phase !== 'finished'
    return snap.state.phase !== 'finished'
  })
}

export function clearHostSnapshot(state: Pick<SessionState, 'gameId' | 'code'>): void {
  void readVaultRaw()
    .then((vault) => {
      delete vault[hostSessionEntryKey(state.gameId, state.code)]
      return writeVault(vault)
    })
    .catch(() => {})
}
