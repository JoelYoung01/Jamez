import type { SessionPlayer, SessionState } from '@jamez/core'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

export interface GamePlayProps {
  state: SessionState
  /** The local player (host player or this guest), if part of the game. */
  me: SessionPlayer | null
  isHost: boolean
  /**
   * Send a game action. Hosts may pass `actorId` to act as a local
   * (pass-and-play) player; guests always act as themselves.
   */
  /** Returns an error string when the host rejects the action; null on success. */
  send: (action: { type: string } & Record<string, unknown>, actorId?: string) => string | null
}

export interface GameSetupProps<C = unknown> {
  config: C
  onChange: (config: C) => void
}

/**
 * The UI half of a game. The scoring half lives in @jamez/core; both are
 * registered by game id (see docs/adding-a-game.md).
 */
export interface GameUIModule {
  id: string
  /** Icon shown on the shelf, host picker, session header and history rows. */
  icon: LucideIcon
  SetupForm: React.ComponentType<GameSetupProps<never>> | React.ComponentType<GameSetupProps>
  PlayView: React.ComponentType<GamePlayProps>
  ResultsDetail?: React.ComponentType<{ state: SessionState }>
  configSummary?: (config: unknown) => string[]
}
