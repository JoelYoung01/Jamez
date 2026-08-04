import { Dices, HistoryIcon } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { PlayerAvatar } from '@/components/player-avatar'
import { ProfileDialog } from '@/components/profile-dialog'
import { SettingsDialog } from '@/components/settings-dialog'
import { Button } from '@/components/ui/button'
import { Toaster } from 'sonner'
import { useProfile } from '@/lib/profile'
import { useSession } from '@/lib/session-store'
import { Badge } from '@/components/ui/badge'

export function AppShell() {
  const { name, emoji } = useProfile()
  const activeCode = useSession((s) => s.code)
  const location = useLocation()
  const inSession = activeCode && location.pathname.startsWith('/session/')

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-10 pt-4">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Dices className="size-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">Jamez</span>
        </Link>
        <div className="flex items-center gap-1.5">
          {activeCode && !inSession && (
            <Button asChild variant="secondary" size="sm">
              <Link to={`/session/${activeCode}`}>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                {activeCode}
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="icon-sm" aria-label="History & stats">
            <Link to="/history">
              <HistoryIcon />
            </Link>
          </Button>
          <SettingsDialog />
          <ProfileDialog>
            <button
              className="ml-1 flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1 pr-3 text-sm transition-colors hover:bg-accent"
              aria-label="Edit profile"
            >
              <PlayerAvatar player={{ name, emoji, color: '#fbbf24' }} size="sm" />
              <span className="max-w-24 truncate font-medium">{name || 'Set name'}</span>
            </button>
          </ProfileDialog>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-12 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground/60">
        <Badge variant="outline" className="text-[10px]">Jamez</Badge>
      </footer>
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  )
}
