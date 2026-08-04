import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_RELAYS } from '@jamez/core'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface SettingsState {
  customRelays: string[] | null
  setCustomRelays: (relays: string[] | null) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      customRelays: null,
      setCustomRelays: (relays) =>
        set({ customRelays: relays && relays.length > 0 ? relays : null }),
    }),
    { name: 'jamez.settings.v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
)

export function activeRelays(): string[] {
  return useSettings.getState().customRelays ?? DEFAULT_RELAYS
}
