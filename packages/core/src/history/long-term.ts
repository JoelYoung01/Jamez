import { getGameEngine } from '../games/registry'
import { isOngoingGame } from '../games/types'
import {
  isOpenRoomStatus,
  normalizeRoomStatus,
  type RoomStatus,
} from '../persistence/room-status'
import type { SessionState } from '../protocol/session-state'
import { historyRecordFromState, type HistoryRecord } from './types'

export interface VaultRoomSnapshot {
  state: SessionState
  savedAt: number
  /** Host-local lifecycle; omitted on legacy vault rows. */
  status?: RoomStatus
}

export interface LongTermRoom {
  key: string
  code: string
  gameId: string
  nickname?: string
  at: number
  /** Host-local room lifecycle for filtering / badges. */
  status: RoomStatus
  /** True when `status === 'active'` (this device has / should have transport). */
  live: boolean
  /** True when this row is an archived (ended) room from history. */
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

/**
 * Open rooms across every game type (draft / active / inactive), optionally
 * plus ended long-term banks from history. The in-memory live session — when
 * provided — is always listed as `active`.
 */
export function listLongTermSessions(
  vault: VaultRoomSnapshot[],
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
      items.push({
        key: `live:${activeCode}`,
        code: activeCode,
        gameId,
        nickname:
          (active && 'nickname' in active ? active.nickname : undefined) ??
          liveSnap?.state.nickname,
        at: Date.now(),
        status: 'active',
        live: true,
        ended: false,
        phase: liveSnap?.state.phase ?? 'playing',
      })
      seenCodes.add(activeCode)
    }
  }

  for (const snap of vault) {
    const status = normalizeRoomStatus(snap.status, snap.state.phase)
    if (!isOpenRoomStatus(status)) continue
    if (activeCode && snap.state.code === activeCode) continue
    // A vault row still marked active while another room is live was demoted
    // in spirit — surface it as parked/draft so UI never shows two Lives.
    const shown: RoomStatus = status === 'active' ? parkFallback(snap.state.phase) : status
    items.push({
      key: `parked:${snap.state.gameId}:${snap.state.code}`,
      code: snap.state.code,
      gameId: snap.state.gameId,
      nickname: snap.state.nickname,
      at: snap.savedAt,
      status: shown,
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
        status: 'complete',
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

function parkFallback(phase: SessionState['phase']): 'draft' | 'inactive' {
  return phase === 'lobby' ? 'draft' : 'inactive'
}
