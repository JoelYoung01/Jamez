import {
  ginBoxes,
  ginFinalTally,
  ginTotals,
  scoreGinHand,
  type GinConfig,
  type GinOutcome,
  type GinState,
  type SessionState,
} from '@jamez/core'
import { Undo2Icon } from 'lucide-react'
import * as React from 'react'
import { PlayerAvatar } from '@/components/player-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { GamePlayProps, GameSetupProps, GameUIModule } from './types'

function GinSetup({ config, onChange }: GameSetupProps<GinConfig>) {
  const numberField = (key: keyof GinConfig, label: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`gin-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`gin-${key}`}
        inputMode="numeric"
        value={String(config[key])}
        onChange={(e) => {
          const value = Number.parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
          onChange({ ...config, [key]: Number.isNaN(value) ? 0 : Math.min(1000, value) })
        }}
        className="h-9 font-mono tabular-nums"
      />
    </div>
  )

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        {numberField('targetScore', 'Play to')}
        {numberField('lineBonus', 'Line / box bonus')}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {numberField('ginBonus', 'Gin bonus')}
        {numberField('bigGinBonus', 'Big gin bonus')}
        {numberField('undercutBonus', 'Undercut bonus')}
      </div>
      <div className="grid grid-cols-2 items-end gap-3">
        {numberField('gameBonus', 'Game bonus')}
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <Label htmlFor="gin-shutout" className="text-xs text-muted-foreground">
            Shutout doubles it
          </Label>
          <Switch
            id="gin-shutout"
            checked={config.shutoutDoublesGameBonus}
            onCheckedChange={(v) => onChange({ ...config, shutoutDoublesGameBonus: v })}
          />
        </div>
      </div>
    </div>
  )
}

function RecordHandForm({ state: session, me, isHost, send }: GamePlayProps) {
  const game = session.game as GinState
  const [p1, p2] = game.playerIds
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  const [knockerId, setKnockerId] = React.useState(me && game.playerIds.includes(me.id) ? me.id : p1)
  const [outcome, setOutcome] = React.useState<GinOutcome>('knock')
  const [knockerDeadwood, setKnockerDeadwood] = React.useState('')
  const [defenderDeadwood, setDefenderDeadwood] = React.useState('')

  const defenderId = knockerId === p1 ? p2 : p1
  const kd = outcome === 'knock' ? Number.parseInt(knockerDeadwood || 'NaN', 10) : 0
  const dd = Number.parseInt(defenderDeadwood || 'NaN', 10)
  const valid =
    !Number.isNaN(dd) && dd >= 0 && (outcome !== 'knock' || (!Number.isNaN(kd) && kd >= 1 && kd <= 10))

  const preview = valid
    ? scoreGinHand(game.config, {
        knockerId,
        defenderId,
        outcome,
        knockerDeadwood: kd,
        defenderDeadwood: dd,
      })
    : null

  const submit = () => {
    if (!valid) return
    send({
      type: 'recordHand',
      knockerId,
      outcome,
      knockerDeadwood: kd,
      defenderDeadwood: dd,
    })
    setKnockerDeadwood('')
    setDefenderDeadwood('')
    setOutcome('knock')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Record a hand</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Who knocked?</Label>
          <Segmented
            value={knockerId}
            onChange={setKnockerId}
            options={game.playerIds.map((id) => ({
              value: id,
              label: (
                <span className="flex items-center gap-1.5">
                  <span>{playerOf(id)?.emoji}</span>
                  {playerOf(id)?.name ?? '?'}
                </span>
              ),
            }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Result</Label>
          <Segmented
            value={outcome}
            onChange={(v) => setOutcome(v)}
            options={[
              { value: 'knock', label: 'Knock' },
              { value: 'gin', label: 'Gin' },
              { value: 'bigGin', label: 'Big gin' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="kd" className="text-xs text-muted-foreground">
              {playerOf(knockerId)?.name}'s deadwood
            </Label>
            <Input
              id="kd"
              inputMode="numeric"
              placeholder={outcome === 'knock' ? '1–10' : '0 (gin!)'}
              disabled={outcome !== 'knock'}
              value={outcome === 'knock' ? knockerDeadwood : '0'}
              onChange={(e) => setKnockerDeadwood(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              className="h-11 text-center font-mono text-lg tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dd" className="text-xs text-muted-foreground">
              {playerOf(defenderId)?.name}'s deadwood
            </Label>
            <Input
              id="dd"
              inputMode="numeric"
              placeholder="after layoffs"
              value={defenderDeadwood}
              onChange={(e) => setDefenderDeadwood(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              className="h-11 text-center font-mono text-lg tabular-nums"
            />
          </div>
        </div>
        {preview && (
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-center text-sm font-medium',
              preview.undercut ? 'bg-rose-400/10 text-rose-300' : 'bg-emerald-400/10 text-emerald-300',
            )}
          >
            {preview.undercut && '⚡ Undercut! '}
            {playerOf(preview.winnerId)?.name} scores +{preview.points}
          </div>
        )}
        <Button size="lg" disabled={!valid} onClick={submit}>
          Add hand
        </Button>
        {!isHost && (
          <p className="text-center text-xs text-muted-foreground/70">
            The host confirms every entry — mistakes can be undone on the host device.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function GinPlay(props: GamePlayProps) {
  const { state: session, isHost, send } = props
  const game = session.game as GinState
  const totals = ginTotals(game)
  const boxes = ginBoxes(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        {game.playerIds.map((id) => {
          const player = playerOf(id)
          const total = totals[id] ?? 0
          const progress = Math.min(1, total / game.config.targetScore)
          if (!player) return null
          return (
            <Card key={id} className={cn(game.dealerId === id && 'ring-1 ring-primary/40')}>
              <CardContent className="flex flex-col items-center gap-1.5 p-4">
                <PlayerAvatar player={player} showPresence />
                <div className="max-w-full truncate text-sm font-medium">{player.name}</div>
                <div className="font-mono text-4xl font-bold tabular-nums">{total}</div>
                <div className="text-xs text-muted-foreground">
                  {boxes[id] ?? 0} {(boxes[id] ?? 0) === 1 ? 'hand' : 'hands'} won
                  {game.dealerId === id && <span className="ml-1 text-primary">· dealing</span>}
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        First to <span className="font-semibold text-foreground">{game.config.targetScore}</span> wins
        the match
      </p>

      <RecordHandForm {...props} />

      {game.hands.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Hands</CardTitle>
            {isHost && (
              <Button variant="ghost" size="sm" onClick={() => send({ type: 'undoHand' })}>
                <Undo2Icon /> Undo last
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-1.5">
            {[...game.hands].reverse().map((hand) => {
              const winner = playerOf(hand.winnerId)
              const knocker = playerOf(hand.knockerId)
              const description =
                hand.outcome === 'gin'
                  ? `${knocker?.name} went gin (${hand.defenderDeadwood} deadwood caught)`
                  : hand.outcome === 'bigGin'
                    ? `${knocker?.name} went BIG gin!`
                    : hand.undercut
                      ? `${winner?.name} undercut ${knocker?.name} (${hand.defenderDeadwood} vs ${hand.knockerDeadwood})`
                      : `${knocker?.name} knocked with ${hand.knockerDeadwood} vs ${hand.defenderDeadwood}`
              return (
                <div
                  key={hand.n}
                  className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm"
                >
                  <span className="w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">
                    #{hand.n}
                  </span>
                  <span className="shrink-0">{winner?.emoji}</span>
                  <span className={cn('min-w-0 flex-1 truncate', hand.undercut && 'text-rose-300')}>
                    {description}
                  </span>
                  <span className="shrink-0 font-mono font-semibold tabular-nums text-emerald-300">
                    +{hand.points}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function GinResults({ state: session }: { state: SessionState }) {
  const game = session.game as GinState
  const tally = ginFinalTally(game)
  const playerOf = (id: string) => session.players.find((p) => p.id === id)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Final tally</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {tally.map((line) => {
          const player = playerOf(line.playerId)
          return (
            <div key={line.playerId} className="rounded-xl border border-border/50 p-3">
              <div className="flex items-center gap-2">
                <span>{player?.emoji}</span>
                <span className="flex-1 font-medium">{player?.name}</span>
                <span className="font-mono text-xl font-bold tabular-nums text-primary">
                  {line.finalScore}
                </span>
              </div>
              <div className="mt-1.5 grid gap-0.5 pl-7 font-mono text-xs tabular-nums text-muted-foreground">
                <span>hand points: {line.handPoints}</span>
                <span>
                  boxes: {line.boxes} × {game.config.lineBonus} = {line.lineBonusTotal}
                </span>
                {line.gameBonus > 0 && <span>game bonus: +{line.gameBonus}</span>}
              </div>
            </div>
          )
        })}
        <p className="text-center text-xs text-muted-foreground/70">
          {game.hands.length} {game.hands.length === 1 ? 'hand' : 'hands'} played
        </p>
      </CardContent>
    </Card>
  )
}

export const ginRummyUI: GameUIModule = {
  id: 'gin-rummy',
  SetupForm: GinSetup as GameUIModule['SetupForm'],
  PlayView: GinPlay,
  ResultsDetail: GinResults,
  configSummary: (config) => {
    const c = config as GinConfig
    return [`First to ${c.targetScore}`, `Gin +${c.ginBonus}`, `Boxes ${c.lineBonus}`]
  },
}
