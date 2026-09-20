import { gameEngines, getGameEngine, SESSION_NICKNAME_MAX } from '@jamez/core'
import { ArrowLeftIcon, ArrowRightIcon, UsersIcon } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FloatingSearch } from '@/components/floating-search'
import { RequireProfile } from '@/components/require-profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getGameIcon, getGameUI } from '@/games/registry'
import { initialPokerBankConfig } from '@/lib/poker-defaults'
import { listHostSnapshots, useSession } from '@/lib/session-store'

function gameMatchesFilter(
  game: (typeof gameEngines)[number],
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    game.name.toLowerCase().includes(q) ||
    game.tagline.toLowerCase().includes(q) ||
    game.id.toLowerCase().includes(q)
  )
}

export function HostPage() {
  const [filter, setFilter] = React.useState('')
  const filtered = gameEngines.filter((game) => gameMatchesFilter(game, filter))

  return (
    <RequireProfile>
      <div className="relative grid gap-3 pb-24">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm">
            <Link to="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Browse the shelf</h1>
        </div>
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No games match “{filter.trim()}”.
            </CardContent>
          </Card>
        ) : (
          filtered.map((game) => {
            const Icon = getGameIcon(game.id)
            return (
              <Link key={game.id} to={`/host/${game.id}`} className="group">
                <Card className="transition-all group-hover:border-primary/50 group-hover:bg-primary/5">
                  <CardContent className="flex items-center gap-4 p-4">
                    <span
                      className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${game.accentColor}1f` }}
                    >
                      <Icon className="size-6" style={{ color: game.accentColor }} />
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
            )
          })
        )}

        <FloatingSearch
          value={filter}
          onChange={setFilter}
          placeholder="Filter games"
          searchLabel="Search games"
          inputLabel="Filter games"
        />
      </div>
    </RequireProfile>
  )
}

export function HostConfigPage() {
  const { gameId = '' } = useParams()
  const navigate = useNavigate()
  const hostGame = useSession((s) => s.hostGame)
  const activeState = useSession((s) => s.state)
  const game = getGameEngine(gameId)
  const ui = getGameUI(gameId)
  const vault = listHostSnapshots()
  const seededFromPrior =
    gameId === 'poker-bank' &&
    (activeState?.gameId === 'poker-bank' || vault.some((s) => s.state.gameId === 'poker-bank'))
  const [config, setConfig] = React.useState<unknown>(() =>
    gameId === 'poker-bank'
      ? initialPokerBankConfig({ vault, active: activeState })
      : game?.defaultConfig(),
  )
  const [passAndPlay, setPassAndPlay] = React.useState(false)
  const [nickname, setNickname] = React.useState('')

  React.useEffect(() => {
    if (gameId === 'poker-bank') {
      setConfig(
        initialPokerBankConfig({
          vault: listHostSnapshots(),
          active: useSession.getState().state,
        }),
      )
    } else {
      setConfig(getGameEngine(gameId)?.defaultConfig())
    }
    // Two-hand card games (gin, cribbage) no longer offer Pass & Play — networked lobby only.
    setPassAndPlay(false)
    setNickname('')
  }, [gameId])

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
  const GameIcon = getGameIcon(gameId)

  // Two-hand card games always use the networked lobby (same as gin after #47).
  const networkedOnly = gameId === 'gin-rummy' || gameId === 'cribbage'

  const create = () => {
    const code = hostGame({
      gameId,
      config,
      passAndPlay: networkedOnly ? false : passAndPlay,
      nickname,
    })
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
            <GameIcon className="size-5" style={{ color: game.accentColor }} /> Host {game.name}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Game options</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {seededFromPrior ? (
              <p className="text-[11px] text-muted-foreground">
                Starting from your most recent Poker Bank settings.
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="nickname">Nickname (optional)</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, SESSION_NICKNAME_MAX))}
                placeholder="e.g. Friday night bank"
                maxLength={SESSION_NICKNAME_MAX}
              />
            </div>
            <SetupForm config={config} onChange={setConfig} />
          </CardContent>
        </Card>

        {!networkedOnly && (
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
        )}

        <Button size="lg" onClick={create}>
          Open the lobby
        </Button>
        <p className="text-center text-xs text-muted-foreground/70">
          {passAndPlay && !networkedOnly
            ? "You'll add every player yourself on the next screen."
            : 'A join code + QR appears next. Friends hop in from their phones.'}
        </p>
      </div>
    </RequireProfile>
  )
}
