import { getGameEngine, SESSION_NICKNAME_MAX } from '@jamez/core'
import { router, useLocalSearchParams } from 'expo-router'
import * as React from 'react'
import { Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppTextInput } from '@/components/app-text-input'
import { PageHeader } from '@/components/page-header'
import { RequireProfile } from '@/components/require-profile'
import { AppButton, Card, CardTitle, Muted, Screen, SectionLabel } from '@/components/ui'
import { getGameIcon, getGameUI } from '@/games/registry'
import { initialPokerBankConfig } from '@/lib/poker-defaults'
import { listHostSnapshots, useSession } from '@/lib/session-store'

export default function HostConfigScreen() {
  const insets = useSafeAreaInsets()
  const { gameId = '' } = useLocalSearchParams<{ gameId: string }>()
  const hostGame = useSession((s) => s.hostGame)
  const activeState = useSession((s) => s.state)
  const game = getGameEngine(gameId)
  const ui = getGameUI(gameId)
  const [config, setConfig] = React.useState<unknown>(() => game?.defaultConfig())
  const [passAndPlay, setPassAndPlay] = React.useState(false)
  const [nickname, setNickname] = React.useState('')
  const [seededFromPrior, setSeededFromPrior] = React.useState(false)

  React.useEffect(() => {
    if (gameId !== 'poker-bank') return
    let alive = true
    void listHostSnapshots().then((vault) => {
      if (!alive) return
      const next = initialPokerBankConfig({ vault, active: activeState })
      setConfig(next)
      const usedPrior =
        Boolean(activeState?.gameId === 'poker-bank') ||
        vault.some((s) => s.state.gameId === 'poker-bank')
      setSeededFromPrior(usedPrior)
    })
    return () => {
      alive = false
    }
    // Seed once on mount for this game; don't churn if activeState updates later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  if (!game || !ui) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 8 }}>
          <PageHeader title="Unknown game" />
          <Muted>This game isn't on the shelf. Head back and pick another.</Muted>
        </View>
      </Screen>
    )
  }

  const SetupForm = ui.SetupForm as React.ComponentType<{
    config: unknown
    onChange: (c: unknown) => void
  }>
  const GameIcon = getGameIcon(gameId)

  const create = () => {
    const code = hostGame({ gameId, config, passAndPlay, nickname })
    if (code) router.replace(`/session/${code}`)
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 }}>
        <PageHeader title={`Host ${game.name}`} icon={<GameIcon size={20} color={game.accentColor} />} />
        <RequireProfile>
          <View className="gap-4">
            <Card className="gap-3 p-4">
              <CardTitle>Game options</CardTitle>
              {gameId === 'poker-bank' && seededFromPrior ? (
                <Muted>Starting from your most recent Poker Bank settings.</Muted>
              ) : null}
              <View>
                <SectionLabel>Nickname (optional)</SectionLabel>
                <AppTextInput
                  value={nickname}
                  onChangeText={(t) => setNickname(t.slice(0, SESSION_NICKNAME_MAX))}
                  placeholder="e.g. Friday night bank"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  maxLength={SESSION_NICKNAME_MAX}
                  className="h-11 rounded-xl border border-line bg-field px-3 text-base text-zinc-100"
                />
              </View>
              <SetupForm config={config} onChange={setConfig} />
            </Card>

            <Card className="flex-row items-center justify-between p-4">
              <View className="min-w-0 flex-1 pr-3">
                <Text className="text-sm font-medium text-zinc-100">Pass & Play</Text>
                <Muted className="mt-0.5">
                  Everyone plays on this phone. Works with zero connectivity.
                </Muted>
              </View>
              <Switch
                value={passAndPlay}
                onValueChange={setPassAndPlay}
                trackColor={{ false: '#232329', true: '#fbbf24' }}
                thumbColor="#ffffff"
              />
            </Card>

            <AppButton size="lg" title="Open the lobby" onPress={create} />
            <Text className="text-center text-xs text-muted-foreground/70">
              {passAndPlay
                ? "You'll add every player yourself on the next screen."
                : 'A join code + QR appears next. Friends hop in from their phones.'}
            </Text>
          </View>
        </RequireProfile>
      </View>
    </Screen>
  )
}
