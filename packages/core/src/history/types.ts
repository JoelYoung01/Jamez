import type { GinHand } from '../games/gin-rummy'
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
  players: { id: string; name: string; emoji: string; photo?: string }[]
  summary: GameSummary
  /** Which player this device was, so stats know whose wins to count. */
  myPlayerId: string
  /** Optional host-set nickname, copied from the session when it finished. */
  nickname?: string
  /**
   * Optional game-specific archive. Wingspan stays summary-only; gin keeps the
   * hand log (dealer, knock/gin, deadwood) for later analysis.
   */
  detail?: HistoryGameDetail
}

/** Discriminated payload for games that archive more than a summary. */
export type HistoryGameDetail = {
  type: 'gin-rummy'
  hands: GinHand[]
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
  const detail = historyDetailFromState(state)
  return {
    id: state.sessionId,
    gameId: state.gameId,
    code: state.code,
    createdAt: state.createdAt,
    finishedAt: state.finishedAt,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      ...(p.photo ? { photo: p.photo } : {}),
    })),
    summary: state.summary,
    myPlayerId,
    ...(state.nickname ? { nickname: state.nickname } : {}),
    ...(detail ? { detail } : {}),
  }
}

/** Extract a persistable game detail blob from a finished session, if any. */
export function historyDetailFromState(state: SessionState): HistoryGameDetail | undefined {
  if (state.gameId !== 'gin-rummy' || !state.game) return undefined
  const hands = (state.game as { hands?: GinHand[] }).hands
  if (!Array.isArray(hands) || hands.length === 0) return undefined
  // Deep-enough clone so later mutations of live session state cannot rewrite history.
  return {
    type: 'gin-rummy',
    hands: hands.map((h) => ({ ...h })),
  }
}

/** Typed accessor for archived gin hands (empty for older summary-only records). */
export function ginHandsFromHistory(record: HistoryRecord): GinHand[] {
  if (record.detail?.type === 'gin-rummy') return record.detail.hands
  return []
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
