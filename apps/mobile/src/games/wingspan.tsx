import {
  wingspanRanking,
  wingspanTotal,
  type SessionState,
  type WingspanConfig,
  type WingspanState,
} from '@jamez/core'
import { clsx } from 'clsx'
import {
  BirdIcon,
  CheckIcon,
  CrownIcon,
  EggIcon,
  FeatherIcon,
  FlowerIcon,
  GiftIcon,
  NutIcon,
  TargetIcon,
  UtensilsIcon,
  type LucideIcon,
} from 'lucide-react-native'
import * as React from 'react'
import { Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { PlayerAvatar } from '@/components/player-avatar'
import { ScoreStepper } from '@/components/score-stepper'
import { Segmented } from '@/components/segmented'
import { Card } from '@/components/ui'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

const CATEGORIES: { key: string; label: string; hint?: string; icon: LucideIcon }[] = [
  { key: 'birds', label: 'Birds', hint: 'printed points on your bird cards', icon: BirdIcon },
  { key: 'bonusCards', label: 'Bonus cards', hint: 'points from completed bonus cards', icon: GiftIcon },
  { key: 'roundGoals', label: 'End-of-round goals', hint: 'total from the goal board', icon: TargetIcon },
  { key: 'eggs', label: 'Eggs', hint: '1 pt per egg on birds', icon: EggIcon },
  { key: 'foodOnCards', label: 'Cached food', hint: '1 pt per food token on birds', icon: NutIcon },
  { key: 'tuckedCards', label: 'Tucked cards', hint: '1 pt per tucked card', icon: FeatherIcon },
  { key: 'nectar', label: 'Nectar', hint: '5/2 pts per habitat majority (Oceania)', icon: FlowerIcon },
]

function WingspanSetup({ config, onChange }: GameSetupProps<WingspanConfig>) {
  return (
    <View className="flex-row items-center justify-between rounded-xl border border-line bg-field px-4 py-3">
      <View className="flex-1 pr-3">
        <Text className="text-sm font-medium text-zinc-100">Oceania expansion</Text>
        <Text className="text-xs text-muted-foreground">Adds the nectar scoring row</Text>
      </View>
      <Switch
        value={config.nectar}
        onValueChange={(nectar) => onChange({ ...config, nectar })}
        trackColor={{ true: '#fbbf24' }}
        thumbColor="#ffffff"
      />
    </View>
  )
}

function SheetEditor({
  state,
  playerId,
  editable,
  send,
}: {
  state: WingspanState
  playerId: string
  editable: boolean
  send: GamePlayProps['send']
}) {
  const sheet = state.sheets[playerId]
  if (!sheet) return null
  const categories = CATEGORIES.filter((c) => c.key !== 'nectar' || state.config.nectar)
  const setValue = (category: string, value: number) =>
    send({ type: 'setCategory', playerId, category, value })

  return (
    <View className="gap-2">
      {categories.map((category) => (
        <ScoreStepper
          key={category.key}
          label={category.label}
          icon={<category.icon size={16} color="#a1a1ab" />}
          hint={category.hint}
          value={sheet[category.key as keyof typeof sheet] as number}
          onChange={(value) => setValue(category.key, value)}
          disabled={!editable}
        />
      ))}
      <ScoreStepper
        label="Unused food"
        icon={<UtensilsIcon size={16} color="#a1a1ab" />}
        hint="tiebreaker only; not added to the total"
        value={sheet.unusedFood}
        onChange={(value) => setValue('unusedFood', value)}
        disabled={!editable}
        max={99}
      />
      <View className="mt-1 flex-row items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
        <Text className="text-sm font-semibold text-primary">Total</Text>
        <Text className="font-mono text-3xl font-bold text-primary">
          {wingspanTotal(sheet, state.config)}
        </Text>
      </View>
      {editable && (
        <View className="flex-row items-center justify-between rounded-xl border border-line px-4 py-3">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-medium text-zinc-100">Done scoring</Text>
            <Text className="text-xs text-muted-foreground">Show everyone your sheet is final</Text>
          </View>
          <Switch
            value={sheet.done}
            onValueChange={(done) => {
              void send({ type: 'setDone', playerId, done })
            }}
            trackColor={{ true: '#fbbf24' }}
            thumbColor="#ffffff"
          />
        </View>
      )}
    </View>
  )
}

function Standings({ state, session }: { state: WingspanState; session: SessionState }) {
  const ranking = wingspanRanking(state)
  const categories = CATEGORIES.filter((c) => c.key !== 'nectar' || state.config.nectar)
  return (
    <View className="gap-2">
      {ranking.map((row) => {
        const player = session.players.find((p) => p.id === row.playerId)
        const sheet = state.sheets[row.playerId]
        if (!player || !sheet) return null
        return (
          <View key={row.playerId} className="rounded-xl border border-line bg-field p-3">
            <View className="flex-row items-center gap-3">
              <View className="w-7 items-center">
                {row.rank === 1 ? (
                  <CrownIcon size={16} color="#fbbf24" />
                ) : (
                  <Text className="text-center font-mono text-sm font-bold text-muted-foreground">
                    #{row.rank}
                  </Text>
                )}
              </View>
              <PlayerAvatar player={player} size="sm" showPresence />
              <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
                <Text className="shrink text-sm font-medium text-zinc-100" numberOfLines={1}>
                  {player.name}
                </Text>
                {sheet.done && <CheckIcon size={14} color="#6ee7b7" />}
              </View>
              <Text className="font-mono text-2xl font-bold text-zinc-100">{row.score}</Text>
            </View>
            <View className="mt-2 flex-row flex-wrap gap-x-3 gap-y-1 pl-10">
              {categories.map((c) => (
                <View key={c.key} className="flex-row items-center gap-1">
                  <c.icon size={12} color="#a1a1ab" />
                  <Text className="font-mono text-xs text-muted-foreground">
                    {sheet[c.key as keyof typeof sheet] as number}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )
      })}
      <Text className="text-center text-xs text-muted-foreground">
        Ties are broken by most unused food tokens.
      </Text>
    </View>
  )
}

function WingspanPlay({ state: session, me, isHost, send }: GamePlayProps) {
  const state = session.game as WingspanState
  const [tab, setTab] = React.useState<'sheet' | 'standings'>('sheet')
  const editablePlayers = isHost ? session.players : session.players.filter((p) => p.id === me?.id)
  const [selectedId, setSelectedId] = React.useState<string | null>(me?.id ?? null)
  const activeId =
    selectedId && editablePlayers.some((p) => p.id === selectedId)
      ? selectedId
      : (editablePlayers[0]?.id ?? null)

  return (
    <View className="gap-3">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'sheet', label: 'Score sheet' },
          { value: 'standings', label: 'Standings' },
        ]}
      />
      {tab === 'sheet' ? (
        <View className="gap-3">
          {editablePlayers.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-1.5">
                {editablePlayers.map((player) => (
                  <Pressable
                    key={player.id}
                    onPress={() => setSelectedId(player.id)}
                    className={clsx(
                      'flex-row items-center gap-1.5 rounded-full border px-3 py-1.5',
                      activeId === player.id ? 'border-primary/60 bg-primary/15' : 'border-line',
                    )}
                  >
                    <Text>{player.emoji}</Text>
                    <Text
                      className={clsx(
                        'text-sm',
                        activeId === player.id ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {player.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
          {activeId ? (
            <SheetEditor
              state={state}
              playerId={activeId}
              editable={isHost || activeId === me?.id}
              send={send}
            />
          ) : (
            <Card className="p-5">
              <Text className="text-center text-sm text-muted-foreground">
                You're spectating. Check the standings tab.
              </Text>
            </Card>
          )}
        </View>
      ) : (
        <Standings state={state} session={session} />
      )}
    </View>
  )
}

function WingspanResults({ state: session }: { state: SessionState }) {
  const state = session.game as WingspanState
  const ranking = wingspanRanking(state)
  const categories = CATEGORIES.filter((c) => c.key !== 'nectar' || state.config.nectar)
  return (
    <Card className="p-4">
      <Text className="mb-3 text-sm font-semibold text-zinc-100">Score sheet</Text>
      <View className="gap-3">
        {ranking.map((row) => {
          const player = session.players.find((p) => p.id === row.playerId)
          const sheet = state.sheets[row.playerId]
          if (!player || !sheet) return null
          return (
            <View key={row.playerId} className="rounded-xl border border-line p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-zinc-100">
                  {player.emoji} {player.name}
                </Text>
                <Text className="font-mono text-lg font-bold text-primary">{row.score}</Text>
              </View>
              <View className="mt-1.5 flex-row flex-wrap gap-x-3 gap-y-0.5">
                {categories.map((c) => (
                  <View key={c.key} className="flex-row items-center gap-1">
                    <c.icon size={12} color="#a1a1ab" />
                    <Text className="font-mono text-xs text-muted-foreground">
                      {sheet[c.key as keyof typeof sheet] as number}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )
        })}
      </View>
    </Card>
  )
}

export const wingspanUI: GameUIModule = {
  id: 'wingspan',
  icon: FeatherIcon,
  SetupForm: WingspanSetup as GameUIModule['SetupForm'],
  PlayView: WingspanPlay,
  ResultsDetail: WingspanResults,
  configSummary: (config) => [(config as WingspanConfig).nectar ? 'With nectar (Oceania)' : 'Base game'],
}
