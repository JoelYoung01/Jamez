import { getGameEngine, isOngoingGame, type SessionState } from '@jamez/core'
import type { HostSnapshot } from '@/lib/host-sessions'

export interface LongTermRoom {
  key: string
  code: string
  gameId: string
  nickname?: string
  at: number
  live: boolean
  phase: string
}

/** Live session + parked ongoing (long-term) host vault rooms. */
export function listLongTermSessions(
  vault: HostSnapshot[],
  active?: Pick<SessionState, 'code' | 'gameId' | 'nickname'> | { code: string } | null,
): LongTermRoom[] {
  const items: LongTermRoom[] = []
  const activeCode = active?.code?.trim() || undefined

  if (activeCode) {
    const liveSnap = vault.find((v) => v.state.code === activeCode)
    const gameId =
      (active && 'gameId' in active ? active.gameId : undefined) ?? liveSnap?.state.gameId
    if (gameId) {
      const engine = getGameEngine(gameId)
      if (engine && isOngoingGame(engine)) {
        items.push({
          key: `live:${activeCode}`,
          code: activeCode,
          gameId,
          nickname:
            (active && 'nickname' in active ? active.nickname : undefined) ??
            liveSnap?.state.nickname,
          at: Date.now(),
          live: true,
          phase: liveSnap?.state.phase ?? 'playing',
        })
      }
    }
  }

  for (const snap of vault) {
    const engine = getGameEngine(snap.state.gameId)
    if (!engine || !isOngoingGame(engine)) continue
    if (snap.state.phase === 'finished') continue
    if (activeCode && snap.state.code === activeCode) continue
    items.push({
      key: `parked:${snap.state.gameId}:${snap.state.code}`,
      code: snap.state.code,
      gameId: snap.state.gameId,
      nickname: snap.state.nickname,
      at: snap.savedAt,
      live: false,
      phase: snap.state.phase,
    })
  }

  return items.sort((a, b) => b.at - a.at)
}
