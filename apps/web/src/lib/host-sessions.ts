import {
  HOST_SESSION_LEGACY_KEY,
  HOST_SESSIONS_VAULT_KEY,
  hostSessionEntryKey,
  isOpenRoomStatus,
  normalizeRoomStatus,
  parkStatusForPhase,
  type RoomStatus,
  type SessionState,
} from '@jamez/core'

export interface HostSnapshot {
  state: SessionState
  passAndPlay: boolean
  savedAt: number
  /** Host-local lifecycle; omitted on legacy vault rows. */
  status?: RoomStatus
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
      [hostSessionEntryKey(snap.state.gameId, snap.state.code)]: {
        ...snap,
        status: normalizeRoomStatus(snap.status, snap.state.phase),
      },
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

/** When promoting a room to active, demote any other active vault rows. */
function demoteOtherActives(vault: Vault, keepKey: string): void {
  for (const [key, snap] of Object.entries(vault)) {
    if (key === keepKey) continue
    const status = normalizeRoomStatus(snap.status, snap.state.phase)
    if (status !== 'active') continue
    vault[key] = {
      ...snap,
      status: parkStatusForPhase(snap.state.phase),
      savedAt: Date.now(),
    }
  }
}

export function persistHostSnapshot(
  state: SessionState,
  passAndPlay: boolean,
  status: RoomStatus = 'active',
): void {
  const vault = readVaultRaw()
  const key = hostSessionEntryKey(state.gameId, state.code)
  if (status === 'active') demoteOtherActives(vault, key)
  vault[key] = { state, passAndPlay, savedAt: Date.now(), status }
  writeVault(vault)
}

export function readHostSnapshot(code?: string): HostSnapshot | null {
  const vault = readVaultRaw()
  if (code) {
    const upper = code.toUpperCase()
    for (const snap of Object.values(vault)) {
      if (snap.state.code === upper) return withNormalizedStatus(snap)
    }
    return null
  }
  const snaps = Object.values(vault).map(withNormalizedStatus)
  if (snaps.length === 0) return null
  const active = snaps.find((s) => s.status === 'active')
  if (active) return active
  const open = snaps.find((s) => isOpenRoomStatus(normalizeRoomStatus(s.status, s.state.phase)))
  return (open ?? snaps.sort((a, b) => b.savedAt - a.savedAt)[0]) ?? null
}

function withNormalizedStatus(snap: HostSnapshot): HostSnapshot {
  return {
    ...snap,
    status: normalizeRoomStatus(snap.status, snap.state.phase),
  }
}

export function listHostSnapshots(): HostSnapshot[] {
  return Object.values(readVaultRaw())
    .map(withNormalizedStatus)
    .sort((a, b) => b.savedAt - a.savedAt)
}

export function listResumableHostSnapshots(): HostSnapshot[] {
  return listHostSnapshots().filter((snap) =>
    isOpenRoomStatus(normalizeRoomStatus(snap.status, snap.state.phase)),
  )
}

/** Vault rows that should rehydrate transport on launch. */
export function listActiveHostSnapshots(): HostSnapshot[] {
  return listHostSnapshots().filter((snap) => snap.status === 'active')
}

export function clearHostSnapshot(state: Pick<SessionState, 'gameId' | 'code'>): void {
  const vault = readVaultRaw()
  delete vault[hostSessionEntryKey(state.gameId, state.code)]
  writeVault(vault)
}

export async function clearHostSnapshotAsync(
  state: Pick<SessionState, 'gameId' | 'code'>,
): Promise<void> {
  clearHostSnapshot(state)
}

export function clearAllHostSnapshots(): void {
  try {
    localStorage.removeItem(HOST_SESSIONS_VAULT_KEY)
    localStorage.removeItem(HOST_SESSION_LEGACY_KEY)
  } catch {
    // non-fatal
  }
}
