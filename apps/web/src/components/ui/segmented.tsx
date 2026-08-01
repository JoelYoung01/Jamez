import * as React from 'react'
import { cn } from '@/lib/utils'

interface SegmentedProps<T extends string> {
  options: { value: T; label: React.ReactNode }[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Simple segmented control (used for small enum pickers like gin outcomes). */
export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div className={cn('inline-flex w-full items-center rounded-xl bg-muted p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
