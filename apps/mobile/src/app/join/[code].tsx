import { isValidJoinCode, normalizeJoinCode } from '@jamez/core'
import { Redirect, useLocalSearchParams } from 'expo-router'

/**
 * Deep-link target: jamez://join/CODE and https://…/join/CODE both land here.
 * The session screen takes care of profile setup + actually joining.
 */
export default function JoinByCodeScreen() {
  const { code: raw = '' } = useLocalSearchParams<{ code: string }>()
  const code = normalizeJoinCode(raw)
  if (!isValidJoinCode(code)) return <Redirect href="/join" />
  return <Redirect href={`/session/${code}`} />
}
