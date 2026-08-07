import { getGameEngine } from '../games/registry'
import { isOngoingGame } from '../games/types'
import type { SessionState } from '../protocol/session-state'
import { historyRecordFromState, type HistoryRecord } from './types'

export interface LongTermRoom {
  key: string
  code: string
  gameId: string
  nickname?: string
  at: number
  live: boolean
  /** True when this row is an archived (ended) bank from history. */
  ended: boolean
  /** History record id when `ended` — open the history detail. */
  historyId?: string
  phase: string
}

/** Finished history rows for ongoing (long-term) games such as Poker Bank. */
export function isEndedLongTermRecord(record: HistoryRecord): boolean {
  const engine = getGameEngine(record.gameId)
  return Boolean(engine && isOngoingGame(engine))
}

/**
 * Build a history record for an ongoing room that is being ended/dissolved.
 * Uses the engine summary when the session was still playing.
 */
export function historyRecordFromOngoingArchive(
  state: SessionState,
  myPlayerId: string,
  now = Date.now(),
): HistoryRecord | null {
  const engine = getGameEngine(state.gameId)
  if (!engine || !isOngoingGame(engine)) return null

  if (state.phase === 'finished' && state.summary && state.finishedAt) {
    return historyRecordFromState(state, myPlayerId)
  }

  const summary =
    state.summary ??
    (state.game
      ? engine.summary(state.game, state.players)
      : { headline: 'Bank closed', winnerIds: [], entries: [] })

  return historyRecordFromState(
    {
      ...state,
      phase: 'finished',
      finishedAt: state.finishedAt ?? now,
      summary,
    },
    myPlayerId,
  )
}

/** Live session + parked ongoing rooms, optionally plus ended banks from history. */
export function listLongTermSessions(
  vault: Array<{ state: SessionState; savedAt: number }>,
  active?: Pick<SessionState, 'code' | 'gameId' | 'nickname'> | { code: string } | null,
  opts?: { includeEnded?: boolean; history?: HistoryRecord[] },
): LongTermRoom[] {
  const items: LongTermRoom[] = []
  const activeCode = active?.code?.trim() || undefined
  const seenCodes = new Set<string>()

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
          ended: false,
          phase: liveSnap?.state.phase ?? 'playing',
        })
        seenCodes.add(activeCode)
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
      ended: false,
      phase: snap.state.phase,
    })
    seenCodes.add(snap.state.code)
  }

  if (opts?.includeEnded) {
    for (const record of opts.history ?? []) {
      if (!isEndedLongTermRecord(record)) continue
      if (seenCodes.has(record.code)) continue
      items.push({
        key: `ended:${record.id}`,
        code: record.code,
        gameId: record.gameId,
        nickname: record.nickname,
        at: record.finishedAt,
        live: false,
        ended: true,
        historyId: record.id,
        phase: 'finished',
      })
      seenCodes.add(record.code)
    }
  }

  return items.sort((a, b) => b.at - a.at)
}
