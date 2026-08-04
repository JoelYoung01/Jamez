import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createGuestSession,
  createHostSession,
  createMemoryTransport,
  createNostrTransport,
  generateJoinCode,
  getGameEngine,
  historyRecordFromState,
  type GuestSession,
  type GuestStatus,
  type HostSession,
  type SessionState,
  type TransportStatus,
  type Unsubscribe,
} from '@jamez/core'
import { create } from 'zustand'
import { historyStore } from './history'
import { currentProfile } from './profile'
import { activeRelays } from './settings'
import { toast } from './toast'

const HOST_SNAPSHOT_KEY = 'jamez.host-session.v1'

export interface HostSnapshot {
  state: SessionState
  passAndPlay: boolean
  savedAt: number
}

export type SessionRole = 'host' | 'guest'

interface SessionStoreState {
  role: SessionRole | null
  code: string | null
  state: SessionState | null
  guestStatus: GuestStatus | null
  transportStatus: TransportStatus
  passAndPlay: boolean

  hostGame: (opts: { gameId: string; config: unknown; passAndPlay: boolean }) => string | null
  joinGame: (code: string) => void
  resumeHost: (code?: string) => Promise<boolean>
  startGame: () => void
  finishGame: () => void
  rematch: () => void
  addLocalPlayer: (profile: { name: string; emoji: string }) => void
  removePlayer: (playerId: string) => void
  sendAction: (action: { type: string } & Record<string, unknown>, actorId?: string) => void
  endSession: () => void
  leaveSession: () => void
}

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

function persistHostSnapshot(state: SessionState, passAndPlay: boolean): void {
  const snapshot: HostSnapshot = { state, passAndPlay, savedAt: Date.now() }
  void AsyncStorage.setItem(HOST_SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => {})
}

export async function readHostSnapshot(): Promise<HostSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(HOST_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HostSnapshot
    if (!parsed?.state?.code) return null
    return parsed
  } catch {
    return null
  }
}

export function clearHostSnapshot(): void {
  void AsyncStorage.removeItem(HOST_SNAPSHOT_KEY).catch(() => {})
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

export const useSession = create<SessionStoreState>()((set, get) => {
  function wireHost(h: HostSession, passAndPlay: boolean): void {
    const profile = currentProfile()
    unsubs.push(
      h.onState.subscribe((state) => {
        set({ state })
        saveHistoryIfFinished(state, profile.id)
      }),
      h.transport.onStatus.subscribe((transportStatus) => set({ transportStatus })),
    )
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
    role: null,
    code: null,
    state: null,
    guestStatus: null,
    transportStatus: 'connecting',
    passAndPlay: false,

    hostGame({ gameId, config, passAndPlay }) {
      const game = getGameEngine(gameId)
      if (!game) {
        toast.error(`Unknown game: ${gameId}`)
        return null
      }
      cleanupRefs()
      const code = generateJoinCode()
      host = createHostSession({
        code,
        game,
        gameConfig: config,
        hostProfile: currentProfile(),
        transport: makeTransport(code, passAndPlay),
        onSnapshot: (state) => persistHostSnapshot(state, passAndPlay),
      })
      wireHost(host, passAndPlay)
      host.start()
      return code
    },

    joinGame(code) {
      const normalized = code.toUpperCase()
      if (get().role === 'guest' && get().code === normalized) return
      cleanupRefs()
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
        guest.transport.onStatus.subscribe((transportStatus) => set({ transportStatus })),
      )
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

    async resumeHost(code) {
      const snapshot = await readHostSnapshot()
      if (!snapshot) return false
      if (code && snapshot.state.code !== code.toUpperCase()) return false
      const game = getGameEngine(snapshot.state.gameId)
      if (!game) return false
      cleanupRefs()
      host = createHostSession({
        code: snapshot.state.code,
        game,
        hostProfile: currentProfile(),
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

    addLocalPlayer(profile) {
      const error = host?.addLocalPlayer(profile)
      if (error) toast.error(error)
    },

    removePlayer(playerId) {
      const error = host?.removePlayer(playerId)
      if (error) toast.error(error)
    },

    sendAction(action, actorId) {
      if (host) {
        const error = host.applyAction(action, actorId ?? host.hostPlayerId)
        if (error) toast.error(error)
        return
      }
      guest?.sendAction(action)
    },

    endSession() {
      host?.end()
      clearHostSnapshot()
      cleanupRefs()
      set({
        role: null,
        code: null,
        state: null,
        guestStatus: null,
        passAndPlay: false,
        transportStatus: 'connecting',
      })
    },

    leaveSession() {
      guest?.leave()
      cleanupRefs()
      set({
        role: null,
        code: null,
        state: null,
        guestStatus: null,
        passAndPlay: false,
        transportStatus: 'connecting',
      })
    },
  }
})
