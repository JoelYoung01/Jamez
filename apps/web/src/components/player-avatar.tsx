import type { SessionPlayer } from '@jamez/core'
import { cn } from '@/lib/utils'

interface PlayerAvatarProps {
  player: Pick<SessionPlayer, 'name' | 'emoji' | 'color'> & Partial<Pick<SessionPlayer, 'connected' | 'remote'>>
  size?: 'sm' | 'md' | 'lg'
  showPresence?: boolean
  className?: string
}

const sizes = {
  sm: 'size-8 text-base',
  md: 'size-10 text-lg',
  lg: 'size-14 text-2xl',
}

export function PlayerAvatar({ player, size = 'md', showPresence = false, className }: PlayerAvatarProps) {
  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      <div
        className={cn('flex items-center justify-center rounded-full bg-secondary ring-2', sizes[size])}
        style={{ boxShadow: `0 0 0 2px ${player.color}55`, backgroundColor: `${player.color}1f` }}
      >
        <span aria-hidden>{player.emoji}</span>
      </div>
      {showPresence && player.remote !== false && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card',
            player.connected ? 'bg-emerald-400' : 'bg-zinc-500',
          )}
          title={player.connected ? 'Connected' : 'Disconnected'}
        />
      )}
    </div>
  )
}
