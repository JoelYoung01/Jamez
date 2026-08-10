import { SearchIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type FloatingSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Accessible label for the open FAB. */
  searchLabel?: string
  /** Accessible label for the text field. */
  inputLabel?: string
  /** When false, the control is not rendered (e.g. empty lists). Default true. */
  visible?: boolean
}

/**
 * Collapsible FAB → search bar, fixed bottom-right — same pattern as Browse the shelf.
 */
export function FloatingSearch({
  value,
  onChange,
  placeholder = 'Filter',
  searchLabel = 'Search',
  inputLabel = 'Filter',
  visible = true,
}: FloatingSearchProps) {
  const [expanded, setExpanded] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const expand = () => {
    setExpanded(true)
    window.setTimeout(() => inputRef.current?.focus(), 80)
  }

  const collapse = () => {
    setExpanded(false)
    onChange('')
  }

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="pointer-events-none mx-auto flex w-full max-w-xl justify-end px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div
          className={cn(
            'pointer-events-auto overflow-hidden shadow-lg transition-[width,border-radius,background-color,border-color] duration-300 ease-out',
            expanded
              ? 'w-full rounded-2xl border border-border bg-card/95 backdrop-blur'
              : 'w-14 rounded-full bg-primary',
          )}
        >
          {expanded ? (
            <div className="flex h-12 items-center gap-2 px-3">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={inputLabel}
                className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') collapse()
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close search"
                onClick={collapse}
              >
                <XIcon />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={expand}
              aria-label={searchLabel}
              className="flex size-14 items-center justify-center text-primary-foreground transition-opacity hover:opacity-90"
            >
              <SearchIcon className="size-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
