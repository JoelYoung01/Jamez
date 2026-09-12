import {
  createGuestSession,
  createHostSession,
  createMemoryTransport,
  createNostrTransport,
  generateJoinCode,
  getGameEngine,
  historyRecordFromOngoingArchive,
  historyRecordFromState,
  isOngoingGame,
  parkStatusForPhase,
  type GuestSession,
  type GuestStatus,
  type HostSession,
  type SessionState,
  type TransportStatus,
  type Unsubscribe,
} from '@jamez/core'
import { toast } from 'sonner'
import { create } from 'zustand'
import { historyStore } from './history'
import {
  clearHostSnapshot,
  clearHostSnapshotAsync,
  listActiveHostSnapshots,
  listHostSnapshots,
  listResumableHostSnapshots,
  persistHostSnapshot,
  readHostSnapshot,
  type HostSnapshot,
} from './host-sessions'
import { usePlayerRoster } from './player-roster'
import { currentProfile } from './profile'
import { activeRelays } from './settings'

export type { HostSnapshot }
export {
  clearHostSnapshotAsync,
  listActiveHostSnapshots,
  listHostSnapshots,
  listResumableHostSnapshots,
  readHostSnapshot,
}

export type SessionRole = 'host' | 'guest'

interface SessionStoreState {
  role: SessionRole | null
  code: string | null
  state: SessionState | null
  guestStatus: GuestStatus | null
  transportStatus: TransportStatus
  passAndPlay: boolean

  hostGame: (opts: {
    gameId: string
    config: unknown
    passAndPlay: boolean
    nickname?: string
  }) => string | null
  joinGame: (code: string) => void
  resumeHost: (code?: string) => boolean
  /** Rehydrate transport for a vault row marked `active` (app launch). */
  restoreActiveHost: () => boolean
  startGame: () => void
  finishGame: () => void
  rematch: () => void
  setNickname: (nickname: string) => void
  addLocalPlayer: (profile: {
    name: string
    emoji: string
    id?: string
    photo?: string
  }) => void
  updateLocalPlayer: (playerId: string, patch: { name?: string; emoji?: string }) => void
  removePlayer: (playerId: string) => void
  deactivatePlayer: (playerId: string) => void
  reactivatePlayer: (playerId: string) => void
  claimSeat: (claimerId: string, seatId: string) => void
  mergePlayers: (fromId: string, toId: string) => void
  sendAction: (
    action: { type: string } & Record<string, unknown>,
    actorId?: string,
  ) => string | null
  /** Stop broadcasting; vault status → draft (lobby) or inactive (in play). */
  parkSession: () => void
  /**
   * End for everyone. Ongoing banks archive standings to history first, then
   * the host snapshot is cleared (dissolve). Match games just dissolve.
   */
  endSession: () => void
  /** End for everyone and drop the room without writing history. */
  discardSession: () => void
  leaveSession: () => void
}

// Live protocol objects are kept outside the zustand state: they are not
// serializable and must survive re-renders. The store only mirrors snapshots.
let host: HostSession | null = null
let guest: GuestSession | null = null
let unsubs: Unsubscribe[] = []

function cleanupRefs(): void {
  for (const u of unsubs) u()
  unsubs = []
  host?.stop()
  guest?.stop()
  host = null
  guest = null
}

/** Park the current host before switching rooms so vault status stays honest. */
function demoteLiveHostToParked(passAndPlay: boolean): void {
  if (!host) return
  const state = host.current
  if (state) persistHostSnapshot(state, passAndPlay, parkStatusForPhase(state.phase))
}

function saveHistoryIfFinished(state: SessionState, myPlayerId: string): void {
  const record = historyRecordFromState(state, myPlayerId)
  if (record) void historyStore.save(record)
}

function makeTransport(code: string, passAndPlay: boolean) {
  return passAndPlay
    ? createMemoryTransport(code)
    : createNostrTransport({ code, relays: activeRelays() })
}

function resetSessionFields() {
  return {
    role: null as SessionRole | null,
    code: null as string | null,
    state: null as SessionState | null,
    guestStatus: null as GuestStatus | null,
    passAndPlay: false,
    transportStatus: 'connecting' as TransportStatus,
  }
}

export const useSession = create<SessionStoreState>()((set, get) => {
  function wireHost(h: HostSession, passAndPlay: boolean): void {
    const profile = currentProfile()
    const rememberRoster = (state: SessionState) => {
      usePlayerRoster.getState().syncFromSession(state.players)
    }
    if (h.current) rememberRoster(h.current)
    unsubs.push(
      h.onState.subscribe((state) => {
        set({ state })
        rememberRoster(state)
        saveHistoryIfFinished(state, profile.id)
      }),
    )
    unsubs.push(h.transport.onStatus.subscribe((transportStatus) => set({ transportStatus })))
    set({
      role: 'host',
      code: h.code,
      state: h.current,
      guestStatus: null,
      passAndPlay,
      transportStatus: h.transport.status,
    })
  }

  return {
    ...resetSessionFields(),

    hostGame({ gameId, config, passAndPlay, nickname }) {
      const game = getGameEngine(gameId)
      if (!game) {
        toast.error(`Unknown game: ${gameId}`)
        return null
      }
      demoteLiveHostToParked(get().passAndPlay)
      cleanupRefs()
      const code = generateJoinCode()
      const profile = currentProfile()
      host = createHostSession({
        code,
        game,
        gameConfig: config,
        hostProfile: profile,
        transport: makeTransport(code, passAndPlay),
        onSnapshot: (state) => persistHostSnapshot(state, passAndPlay, 'active'),
        nickname,
      })
      wireHost(host, passAndPlay)
      host.start()
      return code
    },

    joinGame(code) {
      demoteLiveHostToParked(get().passAndPlay)
      cleanupRefs()
      const normalized = code.toUpperCase()
      const profile = currentProfile()
      guest = createGuestSession({
        code: normalized,
        profile,
        transport: makeTransport(normalized, false),
      })
      unsubs.push(
        guest.onState.subscribe((state) => {
          set({ state })
          saveHistoryIfFinished(state, profile.id)
        }),
        guest.onStatus.subscribe((guestStatus) => set({ guestStatus })),
        guest.onReject.subscribe(({ reason }) => toast.error(reason)),
      )
      unsubs.push(guest.transport.onStatus.subscribe((transportStatus) => set({ transportStatus })))
      set({
        role: 'guest',
        code: normalized,
        state: null,
        guestStatus: guest.status,
        passAndPlay: false,
        transportStatus: guest.transport.status,
      })
      guest.start()
    },

    resumeHost(code) {
      const snapshot = readHostSnapshot(code)
      if (!snapshot) return false
      if (code && snapshot.state.code !== code.toUpperCase()) return false
      const game = getGameEngine(snapshot.state.gameId)
      if (!game) return false
      demoteLiveHostToParked(get().passAndPlay)
      cleanupRefs()
      const profile = currentProfile()
      const passAndPlay = snapshot.passAndPlay
      host = createHostSession({
        code: snapshot.state.code,
        game,
        hostProfile: profile,
        transport: makeTransport(snapshot.state.code, passAndPlay),
        onSnapshot: (state) => persistHostSnapshot(state, passAndPlay, 'active'),
        resumeFrom: snapshot.state,
      })
      // Promote to active immediately so relaunches keep transport up.
      persistHostSnapshot(snapshot.state, passAndPlay, 'active')
      wireHost(host, passAndPlay)
      host.start()
      return true
    },

    restoreActiveHost() {
      if (host || guest) return false
      const active = listActiveHostSnapshots()[0]
      if (!active) return false
      return get().resumeHost(active.state.code)
    },

    startGame() {
      const error = host?.startGame()
      if (error) toast.error(error)
    },

    finishGame() {
      const error = host?.finish()
      if (error) toast.error(error)
    },

    rematch() {
      const error = host?.rematch()
      if (error) toast.error(error)
    },

    setNickname(nickname) {
      host?.setNickname(nickname)
    },

    addLocalPlayer(profile) {
      const error = host?.addLocalPlayer(profile)
      if (error) {
        toast.error(error)
        return
      }
      const players = host?.current?.players ?? []
      const seated = profile.id?.trim()
        ? players.find((p) => p.id === profile.id!.trim())
        : players[players.length - 1]
      if (seated && !seated.isHost) {
        usePlayerRoster.getState().upsert({
          id: seated.id,
          name: seated.name,
          emoji: seated.emoji,
          source: 'local',
          ...(seated.photo || profile.photo
            ? { photo: seated.photo ?? profile.photo }
            : {}),
        })
      }
    },

    updateLocalPlayer(playerId, patch) {
      const error = host?.updateLocalPlayer(playerId, patch)
      if (error) {
        toast.error(error)
        return
      }
      const seated = host?.current?.players.find((p) => p.id === playerId)
      if (seated && !seated.isHost) {
        usePlayerRoster.getState().upsert({
          id: seated.id,
          name: seated.name,
          emoji: seated.emoji,
          source: 'local',
          ...(seated.photo ? { photo: seated.photo } : {}),
        })
      }
    },

    removePlayer(playerId) {
      const error = host?.removePlayer(playerId)
      if (error) toast.error(error)
    },

    deactivatePlayer(playerId) {
      const error = host?.deactivatePlayer(playerId)
      if (error) toast.error(error)
    },

    reactivatePlayer(playerId) {
      const error = host?.reactivatePlayer(playerId)
      if (error) toast.error(error)
    },

    claimSeat(claimerId, seatId) {
      const error = host?.claimSeat(claimerId, seatId)
      if (error) toast.error(error)
    },

    mergePlayers(fromId, toId) {
      const error = host?.mergePlayers(fromId, toId)
      if (error) toast.error(error)
    },

    sendAction(action, actorId) {
      if (host) {
        const error = host.applyAction(action, actorId ?? host.hostPlayerId)
        if (error) toast.error(error)
        return error
      }
      guest?.sendAction(action)
      // Guest rejects arrive async via onReject; treat send as accepted for UI close.
      return null
    },

    parkSession() {
      const state = host?.current
      const passAndPlay = useSession.getState().passAndPlay
      if (state) persistHostSnapshot(state, passAndPlay, parkStatusForPhase(state.phase))
      // Quiet stop — don't tell guests the room is dissolved.
      host?.stop()
      cleanupRefs()
      set(resetSessionFields())
    },

    endSession() {
      const state = host?.current
      const profile = currentProfile()
      if (host && state) {
        const engine = getGameEngine(state.gameId)
        if (engine && isOngoingGame(engine)) {
          if (state.phase === 'playing') {
            // Snapshot standings → saveHistoryIfFinished via onState.
            host.finish()
          } else {
            const record = historyRecordFromOngoingArchive(state, profile.id)
            if (record) void historyStore.save(record)
          }
        }
      }
      host?.end()
      if (state) clearHostSnapshot(state)
      cleanupRefs()
      set(resetSessionFields())
    },

    discardSession() {
      const state = host?.current
      host?.end()
      if (state) clearHostSnapshot(state)
      cleanupRefs()
      set(resetSessionFields())
    },

    leaveSession() {
      guest?.leave()
      cleanupRefs()
      set(resetSessionFields())
    },
  }
})

/** Most recent resumable host snapshot (for the home resume card). */
export function resumableHostSnapshot(): HostSnapshot | null {
  return listResumableHostSnapshots()[0] ?? null
}

/** Archive a parked ongoing room to history, then remove it from the vault. */
export async function archiveParkedSession(snap: HostSnapshot): Promise<void> {
  const profile = currentProfile()
  const record = historyRecordFromOngoingArchive(snap.state, profile.id)
  if (record) await historyStore.save(record)
  await clearHostSnapshotAsync(snap.state)
}

export function sessionIsOngoing(state: SessionState | null | undefined): boolean {
  if (!state) return false
  const engine = getGameEngine(state.gameId)
  return engine ? isOngoingGame(engine) : false
}
