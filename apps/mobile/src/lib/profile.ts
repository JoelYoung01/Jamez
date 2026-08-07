import AsyncStorage from '@react-native-async-storage/async-storage'
import { PLAYER_EMOJI, randomEmoji, randomId, type PlayerProfile } from '@jamez/core'
import * as React from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export { PLAYER_EMOJI, randomEmoji }

interface ProfileState {
  playerId: string
  name: string
  emoji: string
  photo?: string
  setName: (name: string) => void
  setEmoji: (emoji: string) => void
  setPhoto: (photo: string | undefined) => void
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      playerId: randomId(8),
      name: '',
      emoji: randomEmoji(),
      photo: undefined,
      setName: (name) => set({ name: name.trim().slice(0, 24) }),
      setEmoji: (emoji) => set({ emoji }),
      setPhoto: (photo) => set({ photo }),
    }),
    { name: 'jamez.profile.v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
)

export function useProfileHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(useProfile.persist.hasHydrated())
  React.useEffect(() => {
    const unsub = useProfile.persist.onFinishHydration(() => setHydrated(true))
    setHydrated(useProfile.persist.hasHydrated())
    return unsub
  }, [])
  return hydrated
}

export function currentProfile(): PlayerProfile {
  const { playerId, name, emoji, photo } = useProfile.getState()
  return {
    id: playerId,
    name: name || 'Player',
    emoji,
    ...(photo ? { photo } : {}),
  }
}
