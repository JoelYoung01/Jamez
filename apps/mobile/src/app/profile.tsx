import { router } from 'expo-router'
import { View } from 'react-native'
import { PageHeader } from '@/components/page-header'
import { ProfileForm } from '@/components/profile-form'
import { Card, Screen } from '@/components/ui'

export default function ProfileScreen() {
  return (
    <Screen>
      <View className="pt-4">
        <PageHeader title="Your profile" />
        <Card className="p-5">
          <ProfileForm onDone={() => router.back()} />
        </Card>
      </View>
    </Screen>
  )
}
