import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  PLAYER_LIBRARY_STORAGE_KEY,
  PLAYER_ROSTER_STORAGE_KEY,
  filterLibraryPlayers,
  libraryPlayerByClientId,
  mergeLibraryPlayers,
  migrateLibraryEntries,
  setLibraryAlias,
  setLibraryInactive,
  upsertLibraryPlayer,
  type LibraryMergeChoices,
  type LibraryPlayer,
  type LibraryUpsert,
  type SessionPlayer,
} from '@jamez/core'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface PlayerRosterState {
  entries: LibraryPlayer[]
  upsert: (player: LibraryUpsert) => void
  setAlias: (id: string, alias: string) => void
  setInactive: (id: string, inactive: boolean) => void
  merge: (fromId: string, toId: string, choices?: LibraryMergeChoices) => string | null
  available: (seatedIds: Iterable<string>, query?: string) => LibraryPlayer[]
  syncFromSession: (players: SessionPlayer[]) => void
}

function samePlayer(existing: LibraryPlayer, next: LibraryUpsert): boolean {
  const clientIds = next.clientIds ?? existing.clientIds
  const inactive = next.inactive !== undefined ? next.inactive : Boolean(existing.inactive)
  return (
    existing.name === (next.name.trim().slice(0, 24) || existing.name) &&
    existing.emoji === (next.emoji || existing.emoji) &&
    existing.photo === (next.photo !== undefined ? next.photo || undefined : existing.photo) &&
    existing.clientIds.join() === clientIds.join() &&
    Boolean(existing.inactive) === Boolean(inactive)
  )
}

export const usePlayerRoster = create<PlayerRosterState>()(
  persist(
    (set, get) => ({
      entries: [],
      upsert(player) {
        set((s) => ({ entries: upsertLibraryPlayer(s.entries, player) }))
      },
      setAlias(id, alias) {
        set((s) => ({ entries: setLibraryAlias(s.entries, id, alias) }))
      },
      setInactive(id, inactive) {
        set((s) => ({ entries: setLibraryInactive(s.entries, id, inactive) }))
      },
      merge(fromId, toId, choices) {
        const result = mergeLibraryPlayers(get().entries, fromId, toId, choices)
        if ('error' in result) return result.error
        set({ entries: result.entries })
        return null
      },
      available(seatedIds, query = '') {
        return filterLibraryPlayers(get().entries, query, { seatedIds })
      },
      syncFromSession(players) {
        set((s) => {
          let entries = s.entries
          let changed = false
          for (const player of players) {
            if (player.isHost) continue
            const existing =
              entries.find((entry) => entry.id === player.id) ??
              player.clientIds.map((id) => libraryPlayerByClientId(entries, id)).find(Boolean)
            const payload: LibraryUpsert = {
              id: existing?.id ?? player.id,
              name: player.name,
              emoji: player.emoji,
              clientIds: player.clientIds,
              fromClient: player.clientIds.length > 0,
              ...(player.photo !== undefined ? { photo: player.photo } : {}),
              ...(player.connected && player.clientIds.length > 0 ? { inactive: false } : {}),
            }
            const match = entries.find((entry) => entry.id === payload.id)
            if (match && samePlayer(match, payload)) continue
            entries = upsertLibraryPlayer(entries, payload)
            changed = true
          }
          return changed ? { entries } : s
        })
      },
    }),
    {
      name: PLAYER_LIBRARY_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state && state.entries.length > 0) return
        void AsyncStorage.getItem(PLAYER_ROSTER_STORAGE_KEY).then((legacy) => {
          if (!legacy || usePlayerRoster.getState().entries.length > 0) return
          try {
            const parsed = JSON.parse(legacy) as { state?: { entries?: unknown } }
            const entries = migrateLibraryEntries(parsed.state?.entries ?? [])
            if (entries.length > 0) usePlayerRoster.setState({ entries })
          } catch {
            // Leave the library empty when the old roster cannot be read.
          }
        })
      },
    },
  ),
)

export function resolveLibraryPlayer(clientId: string) {
  const entry = libraryPlayerByClientId(usePlayerRoster.getState().entries, clientId)
  if (!entry) return null
  return {
    id: entry.id,
    name: entry.name,
    emoji: entry.emoji,
    photo: entry.photo,
    clientIds: entry.clientIds,
  }
}
