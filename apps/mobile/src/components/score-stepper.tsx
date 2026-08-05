import { clsx } from 'clsx'
import { MinusIcon, PlusIcon } from 'lucide-react-native'
import * as React from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

interface ScoreStepperProps {
  label: string
  /** Optional icon rendered before the label. */
  icon?: React.ReactNode
  hint?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
}

export function ScoreStepper({
  label,
  icon,
  hint,
  value,
  onChange,
  min = 0,
  max = 999,
  disabled = false,
}: ScoreStepperProps) {
  const [text, setText] = React.useState(String(value))
  React.useEffect(() => setText(String(value)), [value])

  const commit = () => {
    const parsed = Number.parseInt(text, 10)
    const next = Number.isNaN(parsed) ? 0 : Math.min(max, Math.max(min, parsed))
    setText(String(next))
    if (next !== value) onChange(next)
  }

  const bump = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta))
    if (next !== value) onChange(next)
  }

  return (
    <View
      className={clsx(
        'flex-row items-center justify-between gap-3 rounded-xl border border-line bg-field px-3 py-2.5',
        disabled && 'opacity-60',
      )}
    >
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {icon}
          <Text className="text-sm font-medium text-zinc-100">{label}</Text>
        </View>
        {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
      </View>
      <View className="flex-row items-center gap-1.5">
        <Pressable
          disabled={disabled || value <= min}
          onPress={() => bump(-1)}
          className={clsx(
            'h-9 w-9 items-center justify-center rounded-lg bg-muted active:opacity-70',
            (disabled || value <= min) && 'opacity-40',
          )}
        >
          <MinusIcon size={16} color="#e4e4e7" />
        </Pressable>
        <TextInput
          value={text}
          editable={!disabled}
          onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          className="h-9 w-14 rounded-lg border border-line bg-transparent text-center font-mono text-lg font-semibold text-zinc-100"
        />
        <Pressable
          disabled={disabled || value >= max}
          onPress={() => bump(1)}
          className={clsx(
            'h-9 w-9 items-center justify-center rounded-lg bg-muted active:opacity-70',
            (disabled || value >= max) && 'opacity-40',
          )}
        >
          <PlusIcon size={16} color="#e4e4e7" />
        </Pressable>
      </View>
    </View>
  )
}
