import { MinusIcon, PlusIcon } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

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
  accent?: string
}

/** A score row: label on the left, [-] [value] [+] on the right. */
export function ScoreStepper({
  label,
  icon,
  hint,
  value,
  onChange,
  min = 0,
  max = 999,
  disabled = false,
  accent,
}: ScoreStepperProps) {
  const [text, setText] = React.useState(String(value))
  React.useEffect(() => setText(String(value)), [value])

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10)
    const next = Number.isNaN(parsed) ? 0 : Math.min(max, Math.max(min, parsed))
    setText(String(next))
    if (next !== value) onChange(next)
  }

  const bump = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta))
    if (next !== value) onChange(next)
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5',
        disabled && 'opacity-60',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {label}
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => bump(-1)}
          className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-all hover:bg-secondary/70 active:scale-95 disabled:opacity-40"
          aria-label={`Decrease ${label}`}
        >
          <MinusIcon className="size-4" />
        </button>
        <input
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          inputMode="numeric"
          className="h-9 w-14 rounded-lg border border-input bg-transparent text-center font-mono text-lg font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          style={accent ? { color: accent } : undefined}
          aria-label={label}
        />
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => bump(1)}
          className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-all hover:bg-secondary/70 active:scale-95 disabled:opacity-40"
          aria-label={`Increase ${label}`}
        >
          <PlusIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
