import { CHIP_COLOR_PRESETS } from '@jamez/core'
import { CheckIcon } from 'lucide-react'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  className?: string
}

function normalizeHex(raw: string): string | null {
  const t = raw.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t.toLowerCase()}`
  return null
}

function isLight(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return false
  const n = Number.parseInt(m[1]!, 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return (r * 299 + g * 587 + b * 114) / 1000 > 160
}

/** Compact swatch trigger with a preset palette + custom hex/native color. */
export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const [panelPos, setPanelPos] = React.useState<{ top: number; left: number } | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  const placePanel = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = 224 // w-56
    const gap = 6
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
    const below = rect.bottom + gap
    const estimatedHeight = 180
    const top =
      below + estimatedHeight > window.innerHeight - 8
        ? Math.max(8, rect.top - gap - estimatedHeight)
        : below
    setPanelPos({ top, left })
  }, [])

  React.useEffect(() => {
    if (open) {
      setDraft(value)
      placePanel()
    }
  }, [open, value, placePanel])

  React.useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onReposition = () => placePanel()
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, placePanel])

  const commitDraft = () => {
    const next = normalizeHex(draft)
    if (next) onChange(next)
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Pick chip color"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-background/60 px-1.5 shadow-xs transition-colors',
          'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        )}
      >
        <span
          className="size-5 shrink-0 rounded-md border border-border/80"
          style={{ backgroundColor: value }}
        />
        <span className="truncate font-mono text-[11px] uppercase text-muted-foreground">
          {value}
        </span>
      </button>

      {open && panelPos
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Chip color palette"
              className="fixed z-[100] w-56 rounded-xl border border-border bg-popover p-3 shadow-xl"
              style={{ top: panelPos.top, left: panelPos.left }}
            >
              <div className="grid grid-cols-8 gap-1.5">
                {CHIP_COLOR_PRESETS.map((color) => {
                  const selected = value.toLowerCase() === color.toLowerCase()
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Choose ${color}`}
                      aria-pressed={selected}
                      onClick={() => {
                        onChange(color)
                        setDraft(color)
                        setOpen(false)
                      }}
                      className={cn(
                        'relative flex aspect-square items-center justify-center rounded-md border border-border/70 transition-transform hover:scale-105',
                        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-popover',
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {selected ? (
                        <CheckIcon
                          className={cn(
                            'size-3 drop-shadow',
                            isLight(color) ? 'text-zinc-900' : 'text-white',
                          )}
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-2">
                <input
                  type="color"
                  aria-label="Custom color"
                  className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-0.5"
                  value={normalizeHex(value) ?? '#a1a1aa'}
                  onChange={(e) => {
                    onChange(e.target.value)
                    setDraft(e.target.value)
                  }}
                />
                <input
                  aria-label="Hex color"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitDraft}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitDraft()
                      setOpen(false)
                    }
                  }}
                  spellCheck={false}
                  className="h-8 min-w-0 rounded-lg border border-input bg-background/60 px-2 font-mono text-xs uppercase shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  placeholder="#rrggbb"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
