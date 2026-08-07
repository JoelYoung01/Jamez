import { cn } from '@/lib/utils'

/** Dynamically colored poker chip SVG. */
export function PokerChip({
  color,
  className,
  size = 40,
  label,
}: {
  color: string
  className?: string
  size?: number
  /** Optional short label drawn on the chip face. */
  label?: string
}) {
  const rim = shade(color, -0.35)
  const highlight = shade(color, 0.25)
  const faceLabel = label?.trim() ?? ''
  const fontSize = faceFontSize(faceLabel)
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
    >
      {label ? <title>{label}</title> : null}
      <circle cx="32" cy="32" r="30" fill={rim} />
      <circle cx="32" cy="32" r="26" fill={color} />
      <circle cx="32" cy="32" r="26" fill="none" stroke={highlight} strokeWidth="2" opacity="0.55" />
      {/* Edge dashes */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 12
        const x1 = 32 + Math.cos(a) * 27.5
        const y1 = 32 + Math.sin(a) * 27.5
        const x2 = 32 + Math.cos(a) * 30
        const y2 = 32 + Math.sin(a) * 30
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={i % 2 === 0 ? '#fafafa' : rim}
            strokeWidth="3"
            strokeLinecap="round"
          />
        )
      })}
      <circle cx="32" cy="32" r="15" fill="none" stroke={highlight} strokeWidth="2.5" opacity="0.85" />
      <circle cx="32" cy="32" r="12.5" fill={shade(color, 0.12)} stroke={rim} strokeWidth="1" />
      {faceLabel ? (
        <text
          x="32"
          y={32 + fontSize * 0.36}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="800"
          fill={contrastInk(color)}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {faceLabel}
        </text>
      ) : null}
    </svg>
  )
}

/** Bigger, bolder face type — scales down slightly for 3–4 digit values. */
function faceFontSize(label: string): number {
  const len = label.length
  if (len <= 2) return 16
  if (len === 3) return 13
  return 11
}

function shade(hex: string, amount: number): string {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return hex
  const num = Number.parseInt(raw, 16)
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round(255 * amount)))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(255 * amount)))
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(255 * amount)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function contrastInk(hex: string): string {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return '#18181b'
  const num = Number.parseInt(raw, 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#18181b' : '#fafafa'
}
