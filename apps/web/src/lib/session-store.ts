import {
  createGuestSession,
  createHostSession,
  createMemoryTransport,
  createNostrTransport,
  generateJoinCode,
  getGameEngine,
  historyRecordFromState,
  isOngoingGame,
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
  listHostSnapshots,
  listResumableHostSnapshots,
  persistHostSnapshot,
  readHostSnapshot,
  type HostSnapshot,
} from './host-sessions'
import { currentProfile } from './profile'
import { activeRelays } from './settings'

export type { HostSnapshot }
export {
  clearHostSnapshotAsync,
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
  startGame: () => void
  finishGame: () => void
  rematch: () => void
  setNickname: (nickname: string) => void
  addLocalPlayer: (profile: { name: string; emoji: string }) => void
  updateLocalPlayer: (playerId: string, patch: { name?: string; emoji?: string }) => void
  removePlayer: (playerId: string) => void
  claimSeat: (claimerId: string, seatId: string) => void
  mergePlayers: (fromId: string, toId: string) => void
  sendAction: (
    action: { type: string } & Record<string, unknown>,
    actorId?: string,
  ) => string | null
  /** Stop broadcasting but keep the snapshot (ongoing banks / resume later). */
  parkSession: () => void
  /** End for everyone and delete the host snapshot (dissolve). */
  endSession: () => void
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

export const useSession = create<SessionStoreState>()((set) => {
  function wireHost(h: HostSession, passAndPlay: boolean): void {
    const profile = currentProfile()
    unsubs.push(
      h.onState.subscribe((state) => {
        set({ state })
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
      cleanupRefs()
      const code = generateJoinCode()
      const profile = currentProfile()
      host = createHostSession({
        code,
        game,
        gameConfig: config,
        hostProfile: profile,
        transport: makeTransport(code, passAndPlay),
        onSnapshot: (state) => persistHostSnapshot(state, passAndPlay),
        nickname,
      })
      wireHost(host, passAndPlay)
      host.start()
      return code
    },

    joinGame(code) {
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
      cleanupRefs()
      const profile = currentProfile()
      host = createHostSession({
        code: snapshot.state.code,
        game,
        hostProfile: profile,
        transport: makeTransport(snapshot.state.code, snapshot.passAndPlay),
        onSnapshot: (state) => persistHostSnapshot(state, snapshot.passAndPlay),
        resumeFrom: snapshot.state,
      })
      wireHost(host, snapshot.passAndPlay)
      host.start()
      return true
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
      if (error) toast.error(error)
    },

    updateLocalPlayer(playerId, patch) {
      const error = host?.updateLocalPlayer(playerId, patch)
      if (error) toast.error(error)
    },

    removePlayer(playerId) {
      const error = host?.removePlayer(playerId)
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
      if (state) persistHostSnapshot(state, passAndPlay)
      // Quiet stop — don't tell guests the bank is dissolved.
      host?.stop()
      cleanupRefs()
      set(resetSessionFields())
    },

    endSession() {
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

export function sessionIsOngoing(state: SessionState | null | undefined): boolean {
  if (!state) return false
  const engine = getGameEngine(state.gameId)
  return engine ? isOngoingGame(engine) : false
}
