import { gameEngines, getGameEngine, SESSION_NICKNAME_MAX } from '@jamez/core'
import { ArrowLeftIcon, ArrowRightIcon, SearchIcon, UsersIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RequireProfile } from '@/components/require-profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getGameIcon, getGameUI } from '@/games/registry'
import { initialPokerBankConfig } from '@/lib/poker-defaults'
import { listHostSnapshots, useSession } from '@/lib/session-store'
import { cn } from '@/lib/utils'

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
  const [expanded, setExpanded] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const filtered = gameEngines.filter((game) => gameMatchesFilter(game, filter))

  const expand = () => {
    setExpanded(true)
    window.setTimeout(() => inputRef.current?.focus(), 80)
  }

  const collapse = () => {
    setExpanded(false)
    setFilter('')
  }

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

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
          <div className="pointer-events-none mx-auto flex w-full max-w-xl justify-end px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div
              className={cn(
                'pointer-events-auto overflow-hidden shadow-lg transition-[width,border-radius,background-color,border-color] duration-300 ease-out',
                expanded
                  ? 'w-full rounded-2xl border border-border bg-card/95 backdrop-blur'
                  : 'w-14 rounded-full bg-primary',
              )}
            >
              {expanded ? (
                <div className="flex h-12 items-center gap-2 px-3">
                  <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter games"
                    aria-label="Filter games"
                    className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') collapse()
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close search"
                    onClick={collapse}
                  >
                    <XIcon />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={expand}
                  aria-label="Search games"
                  className="flex size-14 items-center justify-center text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <SearchIcon className="size-5" />
                </button>
              )}
            </div>
          </div>
        </div>
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

  const create = () => {
    const code = hostGame({ gameId, config, passAndPlay, nickname })
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
