import type { SessionPlayer, SessionState } from '@jamez/core'
import type * as React from 'react'

export interface GamePlayProps {
  state: SessionState
  me: SessionPlayer | null
  isHost: boolean
  send: (action: { type: string } & Record<string, unknown>, actorId?: string) => void
}

export interface GameSetupProps<C = unknown> {
  config: C
  onChange: (config: C) => void
}

export interface GameUIModule {
  id: string
  SetupForm: React.ComponentType<GameSetupProps<never>> | React.ComponentType<GameSetupProps>
  PlayView: React.ComponentType<GamePlayProps>
  ResultsDetail?: React.ComponentType<{ state: SessionState }>
  configSummary?: (config: unknown) => string[]
}
