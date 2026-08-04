import { DEFAULT_RELAYS } from '@jamez/core'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Relay configuration. Priority:
 *   1. `?relay=ws://...` URL parameter (comma separated; used by tests/dev)
 *   2. Relays saved in Settings (e.g. a LAN relay from `pnpm relay`)
 *   3. Default public relays
 */

function urlRelayOverride(): string[] | null {
  if (typeof window === 'undefined') return null
  const param = new URLSearchParams(window.location.search).get('relay')
  if (!param) return null
  const relays = param
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.startsWith('ws://') || r.startsWith('wss://'))
  return relays.length > 0 ? relays : null
}

const URL_OVERRIDE = urlRelayOverride()

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
    { name: 'jamez.settings.v1' },
  ),
)

export function activeRelays(): string[] {
  if (URL_OVERRIDE) return URL_OVERRIDE
  return useSettings.getState().customRelays ?? DEFAULT_RELAYS
}

export function isUsingRelayOverride(): boolean {
  return URL_OVERRIDE !== null
}
