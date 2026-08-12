import AsyncStorage from '@react-native-async-storage/async-storage'
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

/**
 * Host session vault (AsyncStorage).
 *
 * Values are plain JSON under `jamez.host-sessions.v1`, keyed by
 * `${gameId}:${CODE}`. Each entry carries host-local `RoomStatus`
 * (`draft` | `active` | `inactive` | `complete`); `active` means this
 * device should keep transport (and Live Activity) up.
 *
 * On iOS, AsyncStorage lives in the app sandbox and is included in standard
 * device/iCloud backups — good enough to restore a lost phone from backup.
 * Dedicated CloudKit sync is intentionally deferred; keep this shape
 * JSON-serializable so that migration stays easy.
 *
 * All vault mutations are serialized through a promise chain so concurrent
 * read-modify-write calls (nickname edit racing a cash-in, etc.) cannot
 * clobber each other.
 */

export interface HostSnapshot {
  state: SessionState
  passAndPlay: boolean
  savedAt: number
  /** Host-local lifecycle; omitted on legacy vault rows. */
  status?: RoomStatus
}

type Vault = Record<string, HostSnapshot>

/** Serializes vault RMW so later writes always win over in-flight earlier ones. */
let vaultQueue: Promise<void> = Promise.resolve()

function enqueueVaultOp(op: (vault: Vault) => void | Promise<void>): Promise<void> {
  const next = vaultQueue.then(async () => {
    const vault = await readVaultRaw()
    await op(vault)
    await writeVault(vault)
  })
  // Keep the chain alive after failures so later ops still run.
  vaultQueue = next.catch(() => {})
  return next
}

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
      [hostSessionEntryKey(snap.state.gameId, snap.state.code)]: {
        ...snap,
        status: normalizeRoomStatus(snap.status, snap.state.phase),
      },
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

function withNormalizedStatus(snap: HostSnapshot): HostSnapshot {
  return {
    ...snap,
    status: normalizeRoomStatus(snap.status, snap.state.phase),
  }
}

export function persistHostSnapshot(
  state: SessionState,
  passAndPlay: boolean,
  status: RoomStatus = 'active',
): void {
  const snapshot: HostSnapshot = { state, passAndPlay, savedAt: Date.now(), status }
  void enqueueVaultOp((vault) => {
    const key = hostSessionEntryKey(state.gameId, state.code)
    if (status === 'active') demoteOtherActives(vault, key)
    vault[key] = snapshot
  })
}

/** Awaitable persist — used when a follow-up read must see the write. */
export function persistHostSnapshotAsync(
  state: SessionState,
  passAndPlay: boolean,
  status: RoomStatus = 'active',
): Promise<void> {
  const snapshot: HostSnapshot = { state, passAndPlay, savedAt: Date.now(), status }
  return enqueueVaultOp((vault) => {
    const key = hostSessionEntryKey(state.gameId, state.code)
    if (status === 'active') demoteOtherActives(vault, key)
    vault[key] = snapshot
  }).catch(() => {})
}

export async function readHostSnapshot(code?: string): Promise<HostSnapshot | null> {
  // Wait for in-flight writes so resume/list see the latest nickname, etc.
  await vaultQueue.catch(() => {})
  const vault = await readVaultRaw()
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

export async function listHostSnapshots(): Promise<HostSnapshot[]> {
  await vaultQueue.catch(() => {})
  const vault = await readVaultRaw()
  return Object.values(vault).map(withNormalizedStatus).sort((a, b) => b.savedAt - a.savedAt)
}

export async function listResumableHostSnapshots(): Promise<HostSnapshot[]> {
  const snaps = await listHostSnapshots()
  return snaps.filter((snap) =>
    isOpenRoomStatus(normalizeRoomStatus(snap.status, snap.state.phase)),
  )
}

/** Vault rows that should rehydrate transport on launch. */
export async function listActiveHostSnapshots(): Promise<HostSnapshot[]> {
  const snaps = await listHostSnapshots()
  return snaps.filter((snap) => snap.status === 'active')
}

export function clearHostSnapshot(state: Pick<SessionState, 'gameId' | 'code'>): void {
  void clearHostSnapshotAsync(state)
}

export function clearHostSnapshotAsync(
  state: Pick<SessionState, 'gameId' | 'code'>,
): Promise<void> {
  return enqueueVaultOp((vault) => {
    delete vault[hostSessionEntryKey(state.gameId, state.code)]
  }).catch(() => {})
}
