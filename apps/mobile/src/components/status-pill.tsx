import type { TransportStatus } from '@jamez/core'
import { RadioIcon, SmartphoneIcon, WifiOffIcon } from 'lucide-react-native'
import * as React from 'react'
import { Modal, Pressable, Text } from 'react-native'
import { QrCard } from './qr-card'
import { Chip } from './ui'

export function StatusPill({
  transportStatus,
  passAndPlay,
  inviteCode,
}: {
  transportStatus: TransportStatus
  passAndPlay: boolean
  /** When set, the Live badge opens an invite dialog with this join code. */
  inviteCode?: string
}) {
  const [inviteOpen, setInviteOpen] = React.useState(false)

  if (passAndPlay) {
    return (
      <Chip tone="default" icon={<SmartphoneIcon size={12} color="#e4e4e7" />}>
        Pass & Play
      </Chip>
    )
  }
  if (transportStatus === 'connected') {
    const badge = (
      <Chip tone="success" icon={<RadioIcon size={12} color="#6ee7b7" />}>
        Live
      </Chip>
    )
    if (!inviteCode) return badge
    return (
      <>
        <Pressable
          onPress={() => setInviteOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Show join code and QR"
        >
          {badge}
        </Pressable>
        <Modal
          visible={inviteOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setInviteOpen(false)}
        >
          <Pressable
            className="flex-1 justify-center bg-black/70 px-5"
            onPress={() => setInviteOpen(false)}
          >
            <Pressable onPress={() => {}} className="rounded-2xl border border-line bg-card p-5">
              <Text className="mb-4 text-lg font-semibold text-zinc-100">Invite</Text>
              <QrCard code={inviteCode} />
            </Pressable>
          </Pressable>
        </Modal>
      </>
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
