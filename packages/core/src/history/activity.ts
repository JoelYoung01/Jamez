import { getGameEngine } from '../games/registry'
import {
  normalizeNickname,
  type SessionPhase,
  type SessionState,
} from '../protocol/session-state'
import { isEndedLongTermRecord } from './long-term'
import type { HistoryRecord } from './types'

/** Preferred title: nickname when set, otherwise the game's shelf name. */
export function sessionDisplayName(opts: {
  nickname?: string
  gameId: string
  fallback?: string
}): string {
  const nick = normalizeNickname(opts.nickname)
  if (nick) return nick
  return getGameEngine(opts.gameId)?.name ?? opts.fallback ?? opts.gameId
}

export type ActivityItem =
  | {
      kind: 'parked'
      key: string
      gameId: string
      code: string
      sessionId: string
      nickname?: string
      at: number
      phase: SessionPhase
      players: { name: string; emoji: string }[]
    }
  | {
      kind: 'history'
      key: string
      record: HistoryRecord
      /** Host vault still has this session — opening resumes it. */
      canOpen: boolean
      at: number
    }

/**
 * Merge parked host vault sessions with finished history into one feed,
 * newest first. Parked sessions that already have a history row (unusual)
 * are omitted so they don't double-list.
 *
 * Set `includeEndedLongTerm: false` to hide archived ongoing rooms (Poker Bank
 * standings) while keeping parked banks and match history.
 */
export function buildActivityFeed(opts: {
  history: HistoryRecord[]
  /** Host vault snapshots (any phase). */
  vault: Array<{ state: SessionState; savedAt: number }>
  /** Default true — show ended long-term games from history. */
  includeEndedLongTerm?: boolean
}): ActivityItem[] {
  const includeEnded = opts.includeEndedLongTerm !== false
  const items: ActivityItem[] = []
  const historyIds = new Set(opts.history.map((h) => h.id))

  const vaultBySessionId = new Map(opts.vault.map((v) => [v.state.sessionId, v]))
  const vaultByRoom = new Map(
    opts.vault.map((v) => [`${v.state.gameId}:${v.state.code}`, v]),
  )

  for (const snap of opts.vault) {
    if (snap.state.phase === 'finished') continue
    if (historyIds.has(snap.state.sessionId)) continue
    items.push({
      kind: 'parked',
      key: `parked:${snap.state.gameId}:${snap.state.code}`,
      gameId: snap.state.gameId,
      code: snap.state.code,
      sessionId: snap.state.sessionId,
      nickname: snap.state.nickname,
      at: snap.savedAt,
      phase: snap.state.phase,
      players: snap.state.players.map((p) => ({ name: p.name, emoji: p.emoji })),
    })
  }

  for (const record of opts.history) {
    if (!includeEnded && isEndedLongTermRecord(record)) continue
    const vault =
      vaultBySessionId.get(record.id) ?? vaultByRoom.get(`${record.gameId}:${record.code}`)
    items.push({
      kind: 'history',
      key: `hist:${record.id}`,
      record,
      canOpen: Boolean(vault),
      at: record.finishedAt,
    })
  }

  return items.sort((a, b) => b.at - a.at)
}
