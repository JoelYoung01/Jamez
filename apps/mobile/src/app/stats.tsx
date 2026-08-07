import { router } from 'expo-router'
import { ChartColumnIcon } from 'lucide-react-native'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader } from '@/components/page-header'
import { AppButton, Card, CardTitle, Muted, Screen } from '@/components/ui'

export default function StatsScreen() {
  const insets = useSafeAreaInsets()
  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-3">
        <PageHeader title="Stats" />
        <Card className="items-center gap-2 px-6 py-10">
          <View className="mb-1 h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <ChartColumnIcon size={24} color="#fbbf24" />
          </View>
          <CardTitle>Coming soon</CardTitle>
          <Muted className="text-center">
            Richer reports — streaks, balance charts, head-to-heads — will land here.
          </Muted>
          <AppButton
            className="mt-2"
            variant="secondary"
            title="Browse history for now"
            onPress={() => router.push('/history')}
          />
        </Card>
      </View>
    </Screen>
  )
}
