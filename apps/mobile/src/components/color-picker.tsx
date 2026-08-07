import { CHIP_COLOR_PRESETS } from '@jamez/core'
import { clsx } from 'clsx'
import { CheckIcon } from 'lucide-react-native'
import * as React from 'react'
import { Modal, Pressable, Text, TextInput, View } from 'react-native'

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

/** Compact swatch that opens a preset palette + hex field. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(value)

  React.useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const commitDraft = () => {
    const next = normalizeHex(draft)
    if (next) onChange(next)
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Pick chip color"
        onPress={() => setOpen(true)}
        className="h-9 min-w-[4.5rem] flex-row items-center gap-1.5 rounded-lg border border-line bg-background px-1.5"
      >
        <View className="h-5 w-5 rounded-md border border-line" style={{ backgroundColor: value }} />
        <Text className="font-mono text-[10px] uppercase text-muted-foreground">
          {value.replace('#', '').slice(0, 6)}
        </Text>
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/60 px-6"
          onPress={() => setOpen(false)}
        >
          <Pressable
            className="w-full max-w-sm gap-3 rounded-2xl border border-line bg-card p-4"
            onPress={() => {}}
          >
            <Text className="text-base font-semibold text-zinc-100">Chip color</Text>
            <View className="flex-row flex-wrap gap-2">
              {CHIP_COLOR_PRESETS.map((color) => {
                const selected = value.toLowerCase() === color.toLowerCase()
                return (
                  <Pressable
                    key={color}
                    accessibilityLabel={`Choose ${color}`}
                    onPress={() => {
                      onChange(color)
                      setDraft(color)
                      setOpen(false)
                    }}
                    className={clsx(
                      'h-9 w-9 items-center justify-center rounded-lg border border-line',
                      selected && 'border-2 border-primary',
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {selected ? (
                      <CheckIcon size={14} color={isLight(color) ? '#18181b' : '#ffffff'} />
                    ) : null}
                  </Pressable>
                )
              })}
            </View>
            <View className="gap-1.5">
              <Text className="text-xs text-muted-foreground">Custom hex</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onEndEditing={commitDraft}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="#rrggbb"
                placeholderTextColor="#71717a"
                className="h-11 rounded-xl border border-line bg-background px-3 font-mono text-sm uppercase text-zinc-100"
              />
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setOpen(false)}
                className="h-11 flex-1 items-center justify-center rounded-xl bg-muted"
              >
                <Text className="font-medium text-zinc-100">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  commitDraft()
                  setOpen(false)
                }}
                className="h-11 flex-1 items-center justify-center rounded-xl bg-primary"
              >
                <Text className="font-medium text-primary-foreground">Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}
