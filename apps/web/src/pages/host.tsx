import { gameEngines, getGameEngine } from '@jamez/core'
import { ArrowLeftIcon, ArrowRightIcon, UsersIcon } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RequireProfile } from '@/components/require-profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getGameUI } from '@/games/registry'
import { useSession } from '@/lib/session-store'

export function HostPage() {
  return (
    <RequireProfile>
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm">
            <Link to="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Pick a game to host</h1>
        </div>
        {gameEngines.map((game) => (
          <Link key={game.id} to={`/host/${game.id}`} className="group">
            <Card className="transition-all group-hover:border-primary/50 group-hover:bg-primary/5">
              <CardContent className="flex items-center gap-4 p-4">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                  style={{ backgroundColor: `${game.accentColor}1f` }}
                >
                  {game.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{game.name}</div>
                  <div className="truncate text-sm text-muted-foreground">{game.tagline}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <UsersIcon className="size-3" />
                    {game.minPlayers === game.maxPlayers
                      ? `${game.maxPlayers} players`
                      : `${game.minPlayers}–${game.maxPlayers} players`}
                  </div>
                </div>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </RequireProfile>
  )
}

export function HostConfigPage() {
  const { gameId = '' } = useParams()
  const navigate = useNavigate()
  const hostGame = useSession((s) => s.hostGame)
  const game = getGameEngine(gameId)
  const ui = getGameUI(gameId)
  const [config, setConfig] = React.useState<unknown>(() => game?.defaultConfig())
  const [passAndPlay, setPassAndPlay] = React.useState(false)

  if (!game || !ui) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unknown game</CardTitle>
          <CardDescription>
            <Link to="/host" className="text-primary underline">
              Back to the shelf
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const SetupForm = ui.SetupForm as React.ComponentType<{ config: unknown; onChange: (c: unknown) => void }>

  const create = () => {
    const code = hostGame({ gameId, config, passAndPlay })
    if (code) navigate(`/session/${code}`)
  }

  return (
    <RequireProfile>
      <div className="grid gap-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm">
            <Link to="/host">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <span>{game.emoji}</span> Host {game.name}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Game options</CardTitle>
          </CardHeader>
          <CardContent>
            <SetupForm config={config} onChange={setConfig} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <Label htmlFor="pass-and-play">Pass & Play</Label>
              <p className="text-xs text-muted-foreground">
                Everyone plays on this device. Works with zero connectivity.
              </p>
            </div>
            <Switch id="pass-and-play" checked={passAndPlay} onCheckedChange={setPassAndPlay} />
          </CardContent>
        </Card>

        <Button size="lg" onClick={create}>
          Open the lobby
        </Button>
        <p className="text-center text-xs text-muted-foreground/70">
          {passAndPlay
            ? "You'll add every player yourself on the next screen."
            : 'A join code + QR appears next. Friends hop in from their phones.'}
        </p>
      </div>
    </RequireProfile>
  )
}
