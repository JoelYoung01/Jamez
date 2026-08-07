import type { GameSummary } from '../games/types'
import type { SessionState } from '../protocol/session-state'

/**
 * Finished games are stored locally on every participant's device; there is
 * no server copy. Each app supplies its own storage adapter (localStorage on
 * web, AsyncStorage on mobile) implementing HistoryStore.
 */
export interface HistoryRecord {
  /** sessionId of the finished match (rematches produce separate records). */
  id: string
  gameId: string
  code: string
  createdAt: number
  finishedAt: number
  players: { id: string; name: string; emoji: string }[]
  summary: GameSummary
  /** Which player this device was, so stats know whose wins to count. */
  myPlayerId: string
  /** Optional host-set nickname, copied from the session when it finished. */
  nickname?: string
}

export interface HistoryStore {
  list(): Promise<HistoryRecord[]>
  save(record: HistoryRecord): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

export function historyRecordFromState(
  state: SessionState,
  myPlayerId: string,
): HistoryRecord | null {
  if (state.phase !== 'finished' || !state.summary || !state.finishedAt) return null
  return {
    id: state.sessionId,
    gameId: state.gameId,
    code: state.code,
    createdAt: state.createdAt,
    finishedAt: state.finishedAt,
    players: state.players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji })),
    summary: state.summary,
    myPlayerId,
    ...(state.nickname ? { nickname: state.nickname } : {}),
  }
}

export interface GameStats {
  played: number
  wins: number
  bestScore: number | null
}

export interface Stats {
  gamesPlayed: number
  wins: number
  byGame: Record<string, GameStats>
}

export function computeStats(records: HistoryRecord[]): Stats {
  const stats: Stats = { gamesPlayed: 0, wins: 0, byGame: {} }
  for (const record of records) {
    stats.gamesPlayed += 1
    const won = record.summary.winnerIds.includes(record.myPlayerId)
    if (won) stats.wins += 1
    const byGame = (stats.byGame[record.gameId] ??= { played: 0, wins: 0, bestScore: null })
    byGame.played += 1
    if (won) byGame.wins += 1
    const mine = record.summary.entries.find((e) => e.playerId === record.myPlayerId)
    if (mine && (byGame.bestScore === null || mine.score > byGame.bestScore)) {
      byGame.bestScore = mine.score
    }
  }
  return stats
}
