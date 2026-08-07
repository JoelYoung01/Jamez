import * as React from 'react'
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg'

/** Dynamically colored poker chip SVG for React Native. */
export function PokerChip({
  color,
  size = 40,
  label,
}: {
  color: string
  size?: number
  label?: string
}) {
  const rim = shade(color, -0.35)
  const highlight = shade(color, 0.25)
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="30" fill={rim} />
      <Circle cx="32" cy="32" r="26" fill={color} />
      <Circle cx="32" cy="32" r="26" fill="none" stroke={highlight} strokeWidth="2" opacity={0.55} />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 12
        return (
          <Line
            key={i}
            x1={32 + Math.cos(a) * 27.5}
            y1={32 + Math.sin(a) * 27.5}
            x2={32 + Math.cos(a) * 30}
            y2={32 + Math.sin(a) * 30}
            stroke={i % 2 === 0 ? '#fafafa' : rim}
            strokeWidth="3"
            strokeLinecap="round"
          />
        )
      })}
      <Circle cx="32" cy="32" r="14" fill="none" stroke={highlight} strokeWidth="2.5" opacity={0.85} />
      <Circle cx="32" cy="32" r="10" fill={shade(color, 0.12)} stroke={rim} strokeWidth="1" />
      {label ? (
        <SvgText
          x="32"
          y="36"
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill={contrastInk(color)}
        >
          {label}
        </SvgText>
      ) : null}
    </Svg>
  )
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
