import * as React from 'react'
import { Text, View } from 'react-native'
import { create } from 'zustand'

interface ToastState {
  message: string | null
  kind: 'error' | 'info'
  show: (message: string, kind?: 'error' | 'info') => void
  clear: () => void
}

let timer: ReturnType<typeof setTimeout> | null = null

export const useToast = create<ToastState>()((set) => ({
  message: null,
  kind: 'info',
  show: (message, kind = 'info') => {
    if (timer) clearTimeout(timer)
    set({ message, kind })
    timer = setTimeout(() => set({ message: null }), 3200)
  },
  clear: () => set({ message: null }),
}))

export function toast(message: string, kind: 'error' | 'info' = 'info'): void {
  useToast.getState().show(message, kind)
}

toast.error = (message: string) => toast(message, 'error')

/** Rendered once in the root layout. */
export function ToastHost() {
  const { message, kind } = useToast()
  if (!message) return null
  return (
    <View pointerEvents="none" className="absolute inset-x-4 top-16 z-50 items-center">
      <View
        className={`max-w-full rounded-xl border px-4 py-2.5 shadow-lg ${
          kind === 'error' ? 'border-destructive/40 bg-[#2a1214]' : 'border-line bg-card-raised'
        }`}
      >
        <Text className={`text-sm font-medium ${kind === 'error' ? 'text-destructive' : 'text-zinc-100'}`}>
          {message}
        </Text>
      </View>
    </View>
  )
}
