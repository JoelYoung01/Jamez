import type { TransportStatus } from '@jamez/core'
import { Chip } from './ui'

export function StatusPill({
  transportStatus,
  passAndPlay,
}: {
  transportStatus: TransportStatus
  passAndPlay: boolean
}) {
  if (passAndPlay) return <Chip tone="default">📱 Pass & Play</Chip>
  if (transportStatus === 'connected') return <Chip tone="success">● Live</Chip>
  if (transportStatus === 'connecting') return <Chip tone="outline">○ Connecting…</Chip>
  return <Chip tone="destructive">✕ Offline</Chip>
}
