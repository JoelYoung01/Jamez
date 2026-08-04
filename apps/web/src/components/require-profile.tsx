import * as React from 'react'
import { EmojiPicker } from '@/components/emoji-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile } from '@/lib/profile'

/**
 * Gate for host/join flows: if the player hasn't introduced themselves yet,
 * show a friendly inline form instead of the wrapped content.
 */
export function RequireProfile({ children }: { children: React.ReactNode }) {
  const { name, emoji, setName, setEmoji } = useProfile()
  const [draftName, setDraftName] = React.useState('')
  const [draftEmoji, setDraftEmoji] = React.useState(emoji)

  if (name.trim().length > 0) return <>{children}</>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who's playing?</CardTitle>
        <CardDescription>
          Pick a name and emoji. They live only on this device and show up at the table.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="rp-name">Name</Label>
          <Input
            id="rp-name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="e.g. Robin"
            maxLength={24}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draftName.trim()) {
                setEmoji(draftEmoji)
                setName(draftName)
              }
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label>Emoji</Label>
          <EmojiPicker value={draftEmoji} onChange={setDraftEmoji} />
        </div>
        <Button
          size="lg"
          disabled={draftName.trim().length === 0}
          onClick={() => {
            setEmoji(draftEmoji)
            setName(draftName)
          }}
        >
          Continue
        </Button>
      </CardContent>
    </Card>
  )
}
