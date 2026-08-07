import type { SessionPlayer, SessionState } from '@jamez/core'
import type { LucideIcon } from 'lucide-react-native'
import type * as React from 'react'

export interface GamePlayProps {
  state: SessionState
  me: SessionPlayer | null
  isHost: boolean
  /** Returns an error string when the host rejects the action; null on success. */
  send: (action: { type: string } & Record<string, unknown>, actorId?: string) => string | null
}

export interface GameSetupProps<C = unknown> {
  config: C
  onChange: (config: C) => void
}

export interface GameUIModule {
  id: string
  /** Icon shown on the shelf, host picker, session header and history rows. */
  icon: LucideIcon
  SetupForm: React.ComponentType<GameSetupProps<never>> | React.ComponentType<GameSetupProps>
  PlayView: React.ComponentType<GamePlayProps>
  ResultsDetail?: React.ComponentType<{ state: SessionState }>
  configSummary?: (config: unknown) => string[]
}
