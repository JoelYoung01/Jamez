import { PLAYER_COLORS } from '../protocol/session-state'
import type { PokerBankState, PokerLedgerEntry, PokerLedgerKind } from './poker-bank'

/**
 * Poker Bank reporting helpers.
 *
 * Reconstructs per-player balance over time from the authoritative ledger so
 * UIs can chart stacks without inventing their own accounting rules.
 *
 * Claim entries set balance (seat takeover); every other kind applies a signed
 * delta. `claimSeat` remaps guest ledger rows onto the claimer for continuity;
 * `mergePlayers` leaves the source series intact (separate history).
 */

export interface PokerBalanceSample {
  at: number
  balance: number
  entryId: string
  kind: PokerLedgerKind
}

export interface PokerBalanceSeries {
  playerId: string
  name: string
  color: string
  /** Running balance after each ledger event for this player. */
  samples: PokerBalanceSample[]
}

/** One row per distinct ledger timestamp, balances forward-filled. */
export type PokerBalanceChartRow = { at: number } & Record<string, number>

export interface PokerBalanceReport {
  series: PokerBalanceSeries[]
  rows: PokerBalanceChartRow[]
}

export interface PokerBalancePlayerMeta {
  id: string
  name: string
  color: string
}

function applyLedgerBalance(previous: number, entry: PokerLedgerEntry): number {
  // Claim replaces the claimer's stack with the seat balance.
  if (entry.kind === 'claim') return entry.points
  return previous + entry.points
}

function fallbackColor(playerId: string, index: number): string {
  let hash = 0
  for (let i = 0; i < playerId.length; i++) hash = (hash * 31 + playerId.charCodeAt(i)) | 0
  const fromHash = PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length]
  return fromHash ?? PLAYER_COLORS[index % PLAYER_COLORS.length]!
}

/**
 * Walk the ledger chronologically and emit a balance sample for each entry's
 * player. Order of `series` follows first appearance in the ledger.
 */
export function pokerBalanceSeriesFromLedger(
  ledger: readonly PokerLedgerEntry[],
  players: readonly PokerBalancePlayerMeta[] = [],
): PokerBalanceSeries[] {
  const metaById = new Map(players.map((p) => [p.id, p]))
  const balances = new Map<string, number>()
  const seriesById = new Map<string, PokerBalanceSeries>()
  let unknownIndex = 0

  const sorted = [...ledger].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))

  for (const entry of sorted) {
    let series = seriesById.get(entry.playerId)
    if (!series) {
      const meta = metaById.get(entry.playerId)
      series = {
        playerId: entry.playerId,
        name: meta?.name ?? 'Former player',
        color: meta?.color ?? fallbackColor(entry.playerId, unknownIndex++),
        samples: [],
      }
      seriesById.set(entry.playerId, series)
    }

    const next = applyLedgerBalance(balances.get(entry.playerId) ?? 0, entry)
    balances.set(entry.playerId, next)
    series.samples.push({
      at: entry.at,
      balance: next,
      entryId: entry.id,
      kind: entry.kind,
    })
  }

  // Prefer live roster order for currently seated players, then anyone else
  // who only appears historically (claimed seats, merged accounts).
  const ordered: PokerBalanceSeries[] = []
  const seen = new Set<string>()
  for (const player of players) {
    const series = seriesById.get(player.id)
    if (!series) continue
    ordered.push({ ...series, name: player.name, color: player.color })
    seen.add(player.id)
  }
  for (const series of seriesById.values()) {
    if (seen.has(series.playerId)) continue
    ordered.push(series)
  }
  return ordered
}

/**
 * Pivot per-player samples into Recharts-friendly rows. Each row is a
 * timestamp; missing players keep their last known balance (forward-fill).
 */
export function pokerBalanceChartRows(series: readonly PokerBalanceSeries[]): PokerBalanceChartRow[] {
  if (series.length === 0) return []

  const times = new Set<number>()
  for (const s of series) {
    for (const sample of s.samples) times.add(sample.at)
  }
  const sortedTimes = [...times].sort((a, b) => a - b)

  const cursors = series.map(() => 0)
  const last = series.map(() => 0)
  const rows: PokerBalanceChartRow[] = []

  for (const at of sortedTimes) {
    const row: PokerBalanceChartRow = { at }
    series.forEach((s, i) => {
      const samples = s.samples
      while (cursors[i]! < samples.length && samples[cursors[i]!]!.at <= at) {
        last[i] = samples[cursors[i]!]!.balance
        cursors[i]! += 1
      }
      // Only include a player once they have appeared in the ledger.
      if (cursors[i]! > 0) {
        row[s.playerId] = last[i]!
      }
    })
    rows.push(row)
  }

  return rows
}

/** Build series + pivoted rows for a live or parked Poker Bank session. */
export function buildPokerBalanceReport(
  state: Pick<PokerBankState, 'ledger'>,
  players: readonly PokerBalancePlayerMeta[],
): PokerBalanceReport {
  const series = pokerBalanceSeriesFromLedger(state.ledger, players)
  return { series, rows: pokerBalanceChartRows(series) }
}
