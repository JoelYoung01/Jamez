import type { TransportStatus } from '@jamez/core'
import { RadioIcon, SmartphoneIcon, WifiOffIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface StatusPillProps {
  transportStatus: TransportStatus
  passAndPlay: boolean
}

export function StatusPill({ transportStatus, passAndPlay }: StatusPillProps) {
  if (passAndPlay) {
    return (
      <Badge variant="secondary">
        <SmartphoneIcon className="size-3" /> Pass & Play
      </Badge>
    )
  }
  if (transportStatus === 'connected') {
    return (
      <Badge variant="success">
        <RadioIcon className="size-3" /> Live
      </Badge>
    )
  }
  if (transportStatus === 'connecting') {
    return (
      <Badge variant="outline">
        <RadioIcon className="size-3 animate-pulse" /> Connecting…
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">
      <WifiOffIcon className="size-3" /> Offline
    </Badge>
  )
}
