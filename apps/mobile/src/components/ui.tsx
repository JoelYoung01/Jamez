import { clsx } from 'clsx'
import * as React from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { keyboardScrollPadding, useKeyboardHeight } from '@/lib/keyboard'

/** Scrollable page container with bottom safe-area + keyboard padding. */
export function Screen({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()
  const bottomPad = insets.bottom + 32 + keyboardScrollPadding(keyboardHeight)

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: bottomPad, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View className={clsx('w-full max-w-xl self-center', padded && 'px-4 pt-4')}>{children}</View>
    </ScrollView>
  )
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={clsx('rounded-2xl border border-line bg-card', className)}>{children}</View>
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm font-semibold text-zinc-100">{children}</Text>
}

export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Text className={clsx('text-xs text-muted-foreground', className)}>{children}</Text>
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'

const buttonBase: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-muted',
  ghost: 'bg-transparent',
  destructive: 'bg-destructive/15',
  outline: 'border border-line bg-transparent',
}

const buttonText: Record<ButtonVariant, string> = {
  primary: 'text-primary-foreground',
  secondary: 'text-zinc-100',
  ghost: 'text-muted-foreground',
  destructive: 'text-destructive',
  outline: 'text-zinc-100',
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconRight,
  className,
}: {
  title: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  className?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={clsx(
        'flex-row items-center justify-center gap-2 rounded-xl active:opacity-80',
        size === 'sm' ? 'h-9 px-3' : size === 'lg' ? 'h-14 px-6' : 'h-12 px-4',
        buttonBase[variant],
        (disabled || loading) && 'opacity-40',
        className,
      )}
    >
      {loading ? <ActivityIndicator size="small" color="#251a02" /> : icon}
      <Text
        className={clsx(
          'font-semibold',
          size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base',
          buttonText[variant],
        )}
      >
        {title}
      </Text>
      {iconRight}
    </Pressable>
  )
}

export function Chip({
  children,
  tone = 'default',
  icon,
  className,
}: {
  children: React.ReactNode
  tone?: 'default' | 'primary' | 'success' | 'outline' | 'destructive'
  /** Optional icon rendered before the text. */
  icon?: React.ReactNode
  className?: string
}) {
  const tones = {
    default: 'bg-muted',
    primary: 'bg-primary/15',
    success: 'bg-emerald-400/15',
    outline: 'border border-line bg-transparent',
    destructive: 'bg-destructive/15',
  }
  const texts = {
    default: 'text-zinc-200',
    primary: 'text-primary',
    success: 'text-emerald-300',
    outline: 'text-muted-foreground',
    destructive: 'text-destructive',
  }
  return (
    <View className={clsx('flex-row items-center gap-1 self-start rounded-full px-2.5 py-1', tones[tone], className)}>
      {icon}
      <Text className={clsx('text-xs font-medium', texts[tone])}>{children}</Text>
    </View>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text className="mb-1.5 text-xs font-medium text-muted-foreground">{children}</Text>
}

export function Spinner({ label }: { label?: string }) {
  return (
    <View className="items-center gap-3 py-10">
      <ActivityIndicator size="large" color="#fbbf24" />
      {label ? <Text className="text-sm text-muted-foreground">{label}</Text> : null}
    </View>
  )
}
