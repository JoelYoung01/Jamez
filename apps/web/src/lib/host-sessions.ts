import {
  HOST_SESSION_LEGACY_KEY,
  HOST_SESSIONS_VAULT_KEY,
  getGameEngine,
  hostSessionEntryKey,
  isOngoingGame,
  type SessionState,
} from '@jamez/core'

export interface HostSnapshot {
  state: SessionState
  passAndPlay: boolean
  savedAt: number
}

type Vault = Record<string, HostSnapshot>

function readVaultRaw(): Vault {
  try {
    const raw = localStorage.getItem(HOST_SESSIONS_VAULT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Vault
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {
    // fall through to legacy migration
  }
  return migrateLegacy()
}

function migrateLegacy(): Vault {
  try {
    const raw = localStorage.getItem(HOST_SESSION_LEGACY_KEY)
    if (!raw) return {}
    const snap = JSON.parse(raw) as HostSnapshot
    if (!snap?.state?.code || !snap.state.gameId) return {}
    const vault: Vault = {
      [hostSessionEntryKey(snap.state.gameId, snap.state.code)]: snap,
    }
    localStorage.setItem(HOST_SESSIONS_VAULT_KEY, JSON.stringify(vault))
    localStorage.removeItem(HOST_SESSION_LEGACY_KEY)
    return vault
  } catch {
    return {}
  }
}

function writeVault(vault: Vault): void {
  try {
    localStorage.setItem(HOST_SESSIONS_VAULT_KEY, JSON.stringify(vault))
  } catch {
    // non-fatal (quota / private mode)
  }
}

export function persistHostSnapshot(state: SessionState, passAndPlay: boolean): void {
  const vault = readVaultRaw()
  const key = hostSessionEntryKey(state.gameId, state.code)
  vault[key] = { state, passAndPlay, savedAt: Date.now() }
  writeVault(vault)
}

export function readHostSnapshot(code?: string): HostSnapshot | null {
  const vault = readVaultRaw()
  if (code) {
    const upper = code.toUpperCase()
    for (const snap of Object.values(vault)) {
      if (snap.state.code === upper) return snap
    }
    return null
  }
  // Prefer an in-progress match snapshot, else the most recently saved.
  const snaps = Object.values(vault)
  if (snaps.length === 0) return null
  const playing = snaps.find((s) => s.state.phase !== 'finished')
  return (playing ?? snaps.sort((a, b) => b.savedAt - a.savedAt)[0]) ?? null
}

export function listHostSnapshots(): HostSnapshot[] {
  return Object.values(readVaultRaw()).sort((a, b) => b.savedAt - a.savedAt)
}

export function listResumableHostSnapshots(): HostSnapshot[] {
  return listHostSnapshots().filter((snap) => {
    const engine = getGameEngine(snap.state.gameId)
    if (!engine) return snap.state.phase !== 'finished'
    if (isOngoingGame(engine)) return snap.state.phase !== 'finished'
    return snap.state.phase !== 'finished'
  })
}

export function clearHostSnapshot(state: Pick<SessionState, 'gameId' | 'code'>): void {
  const vault = readVaultRaw()
  delete vault[hostSessionEntryKey(state.gameId, state.code)]
  writeVault(vault)
}

export function clearAllHostSnapshots(): void {
  try {
    localStorage.removeItem(HOST_SESSIONS_VAULT_KEY)
    localStorage.removeItem(HOST_SESSION_LEGACY_KEY)
  } catch {
    // non-fatal
  }
}
