import type { SessionPlayer } from '@jamez/core'
import { clsx } from 'clsx'
import { Image, Text, View } from 'react-native'

interface PlayerAvatarProps {
  player: Pick<SessionPlayer, 'name' | 'emoji' | 'color'> &
    Partial<Pick<SessionPlayer, 'connected' | 'remote' | 'photo'>>
  size?: 'sm' | 'md' | 'lg'
  showPresence?: boolean
}

export function PlayerAvatar({ player, size = 'md', showPresence = false }: PlayerAvatarProps) {
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
  const text = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'
  const px = size === 'sm' ? 32 : size === 'lg' ? 56 : 40
  return (
    <View className="relative">
      <View
        className={clsx('items-center justify-center overflow-hidden rounded-full', box)}
        style={{ backgroundColor: `${player.color}1f`, borderWidth: 2, borderColor: `${player.color}55` }}
      >
        {player.photo ? (
          <Image source={{ uri: player.photo }} style={{ width: px, height: px }} />
        ) : (
          <Text className={text}>{player.emoji}</Text>
        )}
      </View>
      {showPresence && player.remote !== false && (
        <View
          className={clsx(
            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
            player.connected ? 'bg-emerald-400' : 'bg-zinc-500',
          )}
        />
      )}
    </View>
  )
}
