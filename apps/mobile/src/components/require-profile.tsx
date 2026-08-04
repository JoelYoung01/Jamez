import type * as React from 'react'
import { Text, View } from 'react-native'
import { ProfileForm } from '@/components/profile-form'
import { Card, Spinner } from '@/components/ui'
import { useProfile, useProfileHydrated } from '@/lib/profile'

/**
 * Gate for host/join/session flows: if the player hasn't introduced
 * themselves yet, show a friendly inline form instead of the wrapped content.
 */
export function RequireProfile({ children }: { children: React.ReactNode }) {
  const hydrated = useProfileHydrated()
  const hasName = useProfile((s) => s.name.trim().length > 0)

  if (!hydrated) return <Spinner />
  if (hasName) return <>{children}</>

  return (
    <Card className="p-5">
      <Text className="text-lg font-semibold text-zinc-100">Who's playing?</Text>
      <Text className="mb-4 mt-1 text-sm text-muted-foreground">
        Pick a name and emoji before you sit down at the table.
      </Text>
      <ProfileForm submitLabel="Continue" />
    </Card>
  )
}
