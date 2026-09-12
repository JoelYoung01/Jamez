import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  PLAYER_ROSTER_STORAGE_KEY,
  removeRosterPlayer,
  rosterAvailableForSession,
  upsertRosterPlayer,
  type RosterPlayer,
  type SessionPlayer,
} from '@jamez/core'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface PlayerRosterState {
  entries: RosterPlayer[]
  upsert: (player: Omit<RosterPlayer, 'lastPlayedAt'> & { lastPlayedAt?: number }) => void
  remove: (id: string) => void
  available: (seatedIds: Iterable<string>) => RosterPlayer[]
  /** Upsert non-host seats when host state changes; skips no-op writes. */
  syncFromSession: (players: SessionPlayer[]) => void
}

function rosterFieldsEqual(
  existing: RosterPlayer,
  next: Omit<RosterPlayer, 'lastPlayedAt'> & { lastPlayedAt?: number },
): boolean {
  const source =
    existing.source === 'remote' && next.source === 'local' ? 'remote' : next.source
  const photo = next.photo !== undefined ? next.photo || undefined : existing.photo
  return (
    existing.name === (next.name.trim().slice(0, 24) || existing.name || 'Player') &&
    existing.emoji === (next.emoji || existing.emoji || '🙂') &&
    existing.source === source &&
    existing.photo === photo
  )
}

function payloadFromSessionPlayer(player: SessionPlayer): Omit<RosterPlayer, 'lastPlayedAt'> {
  const base = {
    id: player.id,
    name: player.name,
    emoji: player.emoji,
    source: (player.remote ? 'remote' : 'local') as RosterPlayer['source'],
  }
  return player.photo !== undefined ? { ...base, photo: player.photo } : base
}

export const usePlayerRoster = create<PlayerRosterState>()(
  persist(
    (set, get) => ({
      entries: [],
      upsert(player) {
        set((s) => ({ entries: upsertRosterPlayer(s.entries, player) }))
      },
      remove(id) {
        set((s) => ({ entries: removeRosterPlayer(s.entries, id) }))
      },
      available(seatedIds) {
        return rosterAvailableForSession(get().entries, seatedIds)
      },
      syncFromSession(players) {
        set((s) => {
          let entries = s.entries
          let changed = false
          for (const player of players) {
            if (player.isHost) continue
            const payload = payloadFromSessionPlayer(player)
            const existing = entries.find((e) => e.id === player.id)
            if (existing && rosterFieldsEqual(existing, payload)) continue
            entries = upsertRosterPlayer(entries, payload)
            changed = true
          }
          return changed ? { entries } : s
        })
      },
    }),
    { name: PLAYER_ROSTER_STORAGE_KEY, storage: createJSONStorage(() => AsyncStorage) },
  ),
)
