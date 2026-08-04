import { DEFAULT_RELAYS } from '@jamez/core'
import { SettingsIcon } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { isUsingRelayOverride, useSettings } from '@/lib/settings'

export function SettingsDialog() {
  const { customRelays, setCustomRelays } = useSettings()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState('')

  React.useEffect(() => {
    if (open) setDraft((customRelays ?? []).join('\n'))
  }, [open, customRelays])

  const save = () => {
    const relays = draft
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.startsWith('ws://') || r.startsWith('wss://'))
    setCustomRelays(relays.length > 0 ? relays : null)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Settings">
          <SettingsIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Relays</DialogTitle>
          <DialogDescription>
            Sessions travel through Nostr relays as end-to-end encrypted, ephemeral messages —
            nothing is stored anywhere. Leave empty to use the default public relays, or point at
            your own (run <code className="rounded bg-muted px-1 font-mono text-xs">pnpm relay</code>{' '}
            on any machine for a fully offline LAN game night).
          </DialogDescription>
        </DialogHeader>
        {isUsingRelayOverride() && (
          <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
            A <code>?relay=</code> URL override is active and takes priority over these settings.
          </p>
        )}
        <div className="grid gap-2">
          <Label htmlFor="relays">Custom relays (one per line)</Label>
          <textarea
            id="relays"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={DEFAULT_RELAYS.join('\n')}
            rows={4}
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 font-mono text-xs placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDraft('')}>
            Use defaults
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
