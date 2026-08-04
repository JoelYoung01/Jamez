import { PLAYER_EMOJI } from '@/lib/profile'
import { cn } from '@/lib/utils'

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {PLAYER_EMOJI.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={cn(
            'flex aspect-square items-center justify-center rounded-lg text-xl transition-all hover:bg-accent',
            value === emoji && 'bg-primary/20 ring-2 ring-primary',
          )}
          aria-label={`Choose ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
