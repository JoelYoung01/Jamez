import { EnrollGuest, createNostrTransport, isValidJoinCode, normalizeJoinCode } from '@jamez/core'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import { RequireProfile } from '@/components/require-profile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { currentProfile } from '@/lib/profile'
import { activeRelays } from '@/lib/settings'

export function EnrollPage() {
  return (
    <RequireProfile>
      <EnrollBody />
    </RequireProfile>
  )
}

function EnrollBody() {
  const { code: codeParam } = useParams()
  const code = normalizeJoinCode(codeParam ?? '')
  const [status, setStatus] = React.useState<'working' | 'done' | 'invalid'>('working')

  React.useEffect(() => {
    if (!isValidJoinCode(code)) {
      setStatus('invalid')
      return
    }
    const guest = new EnrollGuest({
      code,
      profile: currentProfile(),
      transport: createNostrTransport({ code, relays: activeRelays() }),
    })
    const unsubscribe = guest.onEnrolled.subscribe(() => setStatus('done'))
    guest.start()
    return () => {
      unsubscribe()
      guest.stop()
    }
  }, [code])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {status === 'done' ? 'You’re in their player list' : 'Adding you'}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {status === 'invalid'
          ? 'That code is not valid.'
          : status === 'done'
            ? 'The host can add you to a game later. You can close this page.'
            : 'Sending your name to the host…'}
      </CardContent>
    </Card>
  )
}
