import {
  defaultPokerBankConfig,
  pokerBankConfigFromSession,
  type PokerBankConfig,
  type SessionState,
} from '@jamez/core'
import type { HostSnapshot } from '@/lib/host-sessions'

/**
 * Starting config for a new Poker Bank host form: live session first, else the
 * most recently updated vault snapshot, else built-in defaults.
 */
export function initialPokerBankConfig(opts: {
  vault: HostSnapshot[]
  active?: SessionState | null
}): PokerBankConfig {
  const active = opts.active
  if (active?.gameId === 'poker-bank') {
    const fromLive = pokerBankConfigFromSession(active)
    if (fromLive) return fromLive
  }

  // Vault is already newest-first from listHostSnapshots.
  for (const snap of opts.vault) {
    if (snap.state.gameId !== 'poker-bank') continue
    const fromSnap = pokerBankConfigFromSession(snap.state)
    if (fromSnap) return fromSnap
  }

  return defaultPokerBankConfig()
}
