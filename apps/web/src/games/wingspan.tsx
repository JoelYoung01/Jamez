import {
  wingspanRanking,
  wingspanTotal,
  type SessionState,
  type WingspanConfig,
  type WingspanState,
} from '@jamez/core'
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
} from 'lucide-react'
import * as React from 'react'
import { PlayerAvatar } from '@/components/player-avatar'
import { ScoreStepper } from '@/components/score-stepper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

const CATEGORIES: { key: string; label: string; hint?: string; icon: LucideIcon }[] = [
  { key: 'birds', label: 'Birds', hint: 'printed points on your bird cards', icon: BirdIcon },
  { key: 'bonusCards', label: 'Bonus cards', hint: 'points from completed bonus cards', icon: GiftIcon },
  { key: 'roundGoals', label: 'End-of-round goals', hint: 'total from the goal board', icon: TargetIcon },
  { key: 'eggs', label: 'Eggs', hint: '1 pt per egg on birds', icon: EggIcon },
  { key: 'foodOnCards', label: 'Cached food', hint: '1 pt per food token on birds', icon: NutIcon },
  { key: 'tuckedCards', label: 'Tucked cards', hint: '1 pt per card tucked under birds', icon: FeatherIcon },
  { key: 'nectar', label: 'Nectar', hint: '5/2 pts per habitat majority (Oceania)', icon: FlowerIcon },
]

function WingspanSetup({ config, onChange }: GameSetupProps<WingspanConfig>) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-4 py-3">
      <div>
        <Label htmlFor="nectar-switch">Oceania expansion</Label>
        <p className="text-xs text-muted-foreground">Adds the nectar scoring row</p>
      </div>
      <Switch
        id="nectar-switch"
        checked={config.nectar}
        onCheckedChange={(nectar) => onChange({ ...config, nectar })}
      />
    </div>
  )
}

function SheetEditor({
  state,
  playerId,
  editable,
  send,
  actorOverride,
}: {
  state: WingspanState
  playerId: string
  editable: boolean
  send: GamePlayProps['send']
  actorOverride?: string
}) {
  const sheet = state.sheets[playerId]
  if (!sheet) return null
  const categories = CATEGORIES.filter((c) => c.key !== 'nectar' || state.config.nectar)

  const setValue = (category: string, value: number) =>
    send({ type: 'setCategory', playerId, category, value }, actorOverride)

  return (
    <div className="grid gap-2">
      {categories.map((category) => (
        <ScoreStepper
          key={category.key}
          label={category.label}
          icon={<category.icon className="size-4 shrink-0 text-muted-foreground" />}
          hint={category.hint}
          value={sheet[category.key as keyof typeof sheet] as number}
          onChange={(value) => setValue(category.key, value)}
          disabled={!editable}
        />
      ))}
      <div className="mt-1 grid gap-2">
        <ScoreStepper
          label="Unused food"
          icon={<UtensilsIcon className="size-4 shrink-0 text-muted-foreground" />}
          hint="tiebreaker only; not added to your total"
          value={sheet.unusedFood}
          onChange={(value) => setValue('unusedFood', value)}
          disabled={!editable}
          max={99}
        />
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
        <span className="text-sm font-medium text-primary">Total</span>
        <span className="font-mono text-3xl font-bold tabular-nums text-primary">
          {wingspanTotal(sheet, state.config)}
        </span>
      </div>
      {editable && (
        <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
          <div>
            <Label htmlFor={`done-${playerId}`}>Done scoring</Label>
            <p className="text-xs text-muted-foreground">Show everyone your sheet is final</p>
          </div>
          <Switch
            id={`done-${playerId}`}
            checked={sheet.done}
            onCheckedChange={(done) => {
              void send({ type: 'setDone', playerId, done }, actorOverride)
            }}
          />
        </div>
      )}
    </div>
  )
}

function Standings({ state, session }: { state: WingspanState; session: SessionState }) {
  const ranking = wingspanRanking(state)
  const categories = CATEGORIES.filter((c) => c.key !== 'nectar' || state.config.nectar)
  return (
    <div className="grid gap-2">
      {ranking.map((row) => {
        const player = session.players.find((p) => p.id === row.playerId)
        const sheet = state.sheets[row.playerId]
        if (!player || !sheet) return null
        return (
          <div key={row.playerId} className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex w-6 justify-center text-center font-mono text-sm font-bold',
                  row.rank === 1 ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {row.rank === 1 ? <CrownIcon className="size-4" /> : `#${row.rank}`}
              </span>
              <PlayerAvatar player={player} size="sm" showPresence />
              <span className="min-w-0 flex-1 truncate font-medium">
                {player.name}
                {sheet.done && <CheckIcon className="ml-1.5 inline size-3.5 text-emerald-400" />}
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums">{row.score}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-9 text-xs text-muted-foreground">
              {categories.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 tabular-nums">
                  <c.icon className="size-3" /> {sheet[c.key as keyof typeof sheet] as number}
                </span>
              ))}
            </div>
          </div>
        )
      })}
      <p className="px-1 text-center text-xs text-muted-foreground/70">
        Ties are broken by most unused food tokens.
      </p>
    </div>
  )
}

function WingspanPlay({ state: session, me, isHost, send }: GamePlayProps) {
  const state = session.game as WingspanState
  const editablePlayers = isHost ? session.players : session.players.filter((p) => p.id === me?.id)
  const [selectedId, setSelectedId] = React.useState<string | null>(me?.id ?? null)
  const activeId =
    selectedId && editablePlayers.some((p) => p.id === selectedId)
      ? selectedId
      : (editablePlayers[0]?.id ?? null)

  return (
    <Tabs defaultValue="sheet">
      <TabsList>
        <TabsTrigger value="sheet">Score sheet</TabsTrigger>
        <TabsTrigger value="standings">Standings</TabsTrigger>
      </TabsList>
      <TabsContent value="sheet" className="grid gap-3">
        {editablePlayers.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {editablePlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => setSelectedId(player.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors',
                  activeId === player.id
                    ? 'border-primary/60 bg-primary/15 text-primary'
                    : 'border-border/60 text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{player.emoji}</span>
                {player.name}
              </button>
            ))}
          </div>
        )}
        {activeId ? (
          <SheetEditor
            state={state}
            playerId={activeId}
            editable={isHost || activeId === me?.id}
            send={send}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Spectating</CardTitle>
              <CardDescription>You're watching this one. Check the standings tab.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </TabsContent>
      <TabsContent value="standings">
        <Standings state={state} session={session} />
      </TabsContent>
    </Tabs>
  )
}

function WingspanResults({ state: session }: { state: SessionState }) {
  const state = session.game as WingspanState
  const categories = CATEGORIES.filter((c) => c.key !== 'nectar' || state.config.nectar)
  const ranking = wingspanRanking(state)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Score sheet</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Category</th>
              {ranking.map((row) => {
                const player = session.players.find((p) => p.id === row.playerId)
                return (
                  <th key={row.playerId} className="pb-2 text-right font-medium">
                    {player?.emoji} {player?.name}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.key} className="border-t border-border/40">
                <td className="py-1.5 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <category.icon className="size-3.5" /> {category.label}
                  </span>
                </td>
                {ranking.map((row) => (
                  <td key={row.playerId} className="py-1.5 text-right font-mono tabular-nums">
                    {state.sheets[row.playerId]?.[category.key as keyof (typeof state.sheets)[string]] as number}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-border">
              <td className="py-2 font-semibold">Total</td>
              {ranking.map((row) => (
                <td key={row.playerId} className="py-2 text-right font-mono text-base font-bold tabular-nums text-primary">
                  {row.score}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </CardContent>
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
