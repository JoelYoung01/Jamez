import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from '@jamez/core'
import { TextInput } from 'react-native'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  autoFocus?: boolean
}

export function CodeInput({ value, onChange, onSubmit, autoFocus }: CodeInputProps) {
  const handleChange = (raw: string) => {
    const cleaned = raw
      .toUpperCase()
      .split('')
      .filter((ch) => JOIN_CODE_ALPHABET.includes(ch))
      .slice(0, JOIN_CODE_LENGTH)
      .join('')
    onChange(cleaned)
  }

  return (
    <TextInput
      value={value}
      onChangeText={handleChange}
      onSubmitEditing={() => {
        if (value.length === JOIN_CODE_LENGTH) onSubmit?.()
      }}
      autoFocus={autoFocus}
      placeholder="ABC123"
      placeholderTextColor="rgba(255,255,255,0.15)"
      autoCapitalize="characters"
      autoCorrect={false}
      className="h-16 w-full rounded-xl border border-line bg-field text-center font-mono text-3xl font-bold text-zinc-100"
      style={{ letterSpacing: 12 }}
    />
  )
}
