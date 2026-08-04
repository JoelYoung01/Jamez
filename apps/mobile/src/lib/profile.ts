import AsyncStorage from '@react-native-async-storage/async-storage'
import { randomId, type PlayerProfile } from '@jamez/core'
import * as React from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const PLAYER_EMOJI = [
  '🦉', '🦜', '🦆', '🐦', '🦅', '🕊️',
  '🦊', '🐻', '🦝', '🐸', '🐙', '🦕',
  '🎲', '🃏', '🎯', '🏆', '🌵', '🍉',
  '🌙', '⚡', '🔥', '❄️', '🌈', '⭐',
]

export function randomEmoji(): string {
  return PLAYER_EMOJI[Math.floor(Math.random() * PLAYER_EMOJI.length)]!
}

interface ProfileState {
  playerId: string
  name: string
  emoji: string
  setName: (name: string) => void
  setEmoji: (emoji: string) => void
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      playerId: randomId(8),
      name: '',
      emoji: randomEmoji(),
      setName: (name) => set({ name: name.trim().slice(0, 24) }),
      setEmoji: (emoji) => set({ emoji }),
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
  const { playerId, name, emoji } = useProfile.getState()
  return { id: playerId, name: name || 'Player', emoji }
}
