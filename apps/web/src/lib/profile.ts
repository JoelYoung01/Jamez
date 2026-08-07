import { PLAYER_EMOJI, randomEmoji, randomId, type PlayerProfile } from '@jamez/core'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
    { name: 'jamez.profile.v1' },
  ),
)

export function currentProfile(): PlayerProfile {
  const { playerId, name, emoji, photo } = useProfile.getState()
  return {
    id: playerId,
    name: name || 'Player',
    emoji,
    ...(photo ? { photo } : {}),
  }
}

export function hasProfileName(): boolean {
  return useProfile.getState().name.trim().length > 0
}
