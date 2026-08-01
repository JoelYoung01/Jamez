import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from '@jamez/core'
import * as React from 'react'
import { cn } from '@/lib/utils'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  autoFocus?: boolean
  className?: string
}

/** Big friendly join-code field: uppercase, restricted alphabet, 6 chars. */
export function CodeInput({ value, onChange, onSubmit, autoFocus, className }: CodeInputProps) {
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
    <input
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value.length === JOIN_CODE_LENGTH) onSubmit?.()
      }}
      autoFocus={autoFocus}
      placeholder="ABC123"
      autoComplete="off"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      inputMode="text"
      className={cn(
        'h-16 w-full rounded-xl border border-input bg-background/60 text-center font-mono text-3xl font-bold uppercase tracking-[0.4em] text-foreground placeholder:text-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        className,
      )}
    />
  )
}
