import type { TransportStatus } from '@jamez/core'
import { RadioIcon, SmartphoneIcon, WifiOffIcon } from 'lucide-react'
import { QrCard } from '@/components/qr-card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface StatusPillProps {
  transportStatus: TransportStatus
  passAndPlay: boolean
  /** When set, the Live badge opens an invite dialog with this join code. */
  inviteCode?: string
}

export function StatusPill({ transportStatus, passAndPlay, inviteCode }: StatusPillProps) {
  if (passAndPlay) {
    return (
      <Badge variant="secondary">
        <SmartphoneIcon className="size-3" /> Pass & Play
      </Badge>
    )
  }
  if (transportStatus === 'connected') {
    const badge = (
      <Badge variant="success">
        <RadioIcon className="size-3" /> Live
      </Badge>
    )
    if (!inviteCode) return badge
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="Show join code and QR"
            className="shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {badge}
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite</DialogTitle>
          </DialogHeader>
          <QrCard code={inviteCode} />
        </DialogContent>
      </Dialog>
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
