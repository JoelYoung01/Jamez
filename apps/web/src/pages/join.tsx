import { JOIN_CODE_LENGTH, isValidJoinCode, normalizeJoinCode } from '@jamez/core'
import { ArrowLeftIcon } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CodeInput } from '@/components/code-input'
import { RequireProfile } from '@/components/require-profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProfile } from '@/lib/profile'
import { useSession } from '@/lib/session-store'

export function JoinPage() {
  const { code: codeParam } = useParams()
  const navigate = useNavigate()
  const joinGame = useSession((s) => s.joinGame)
  const hasName = useProfile((s) => s.name.trim().length > 0)
  const [code, setCode] = React.useState(normalizeJoinCode(codeParam ?? ''))

  const join = React.useCallback(
    (joinCode: string) => {
      joinGame(joinCode)
      navigate(`/session/${joinCode.toUpperCase()}`, { replace: true })
    },
    [joinGame, navigate],
  )

  // Deep link (/join/CODE from a QR scan): join automatically once the
  // profile exists.
  const autoCode = normalizeJoinCode(codeParam ?? '')
  const autoJoinable = autoCode.length === JOIN_CODE_LENGTH
  React.useEffect(() => {
    if (autoJoinable && hasName) join(autoCode)
  }, [autoJoinable, autoCode, hasName, join])

  return (
    <RequireProfile>
      <div className="grid gap-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm">
            <Link to="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Join a game</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Enter the join code</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <CodeInput value={code} onChange={setCode} onSubmit={() => join(code)} autoFocus />
            <Button size="lg" disabled={!isValidJoinCode(code)} onClick={() => join(code)}>
              Join session
            </Button>
          </CardContent>
        </Card>
      </div>
    </RequireProfile>
  )
}
