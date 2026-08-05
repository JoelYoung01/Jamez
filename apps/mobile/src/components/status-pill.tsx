import type { TransportStatus } from '@jamez/core'
import { RadioIcon, SmartphoneIcon, WifiOffIcon } from 'lucide-react-native'
import { Chip } from './ui'

export function StatusPill({
  transportStatus,
  passAndPlay,
}: {
  transportStatus: TransportStatus
  passAndPlay: boolean
}) {
  if (passAndPlay) {
    return (
      <Chip tone="default" icon={<SmartphoneIcon size={12} color="#e4e4e7" />}>
        Pass & Play
      </Chip>
    )
  }
  if (transportStatus === 'connected') {
    return (
      <Chip tone="success" icon={<RadioIcon size={12} color="#6ee7b7" />}>
        Live
      </Chip>
    )
  }
  if (transportStatus === 'connecting') {
    return (
      <Chip tone="outline" icon={<RadioIcon size={12} color="#a1a1ab" />}>
        Connecting…
      </Chip>
    )
  }
  return (
    <Chip tone="destructive" icon={<WifiOffIcon size={12} color="#f87171" />}>
      Offline
    </Chip>
  )
}
