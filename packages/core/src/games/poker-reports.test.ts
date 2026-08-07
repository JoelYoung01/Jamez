import { describe, expect, it } from 'vitest'
import type { PokerLedgerEntry } from './poker-bank'
import {
  buildPokerBalanceReport,
  pokerBalanceChartRows,
  pokerBalanceSeriesFromLedger,
} from './poker-reports'

function entry(
  partial: Omit<PokerLedgerEntry, 'id' | 'by'> & { id?: string; by?: string },
): PokerLedgerEntry {
  return {
    id: partial.id ?? `${partial.playerId}-${partial.at}-${partial.kind}`,
    by: partial.by ?? partial.playerId,
    at: partial.at,
    playerId: partial.playerId,
    kind: partial.kind,
    points: partial.points,
    note: partial.note,
    meta: partial.meta,
  }
}

describe('poker balance reports', () => {
  it('accumulates deposits and withdraws into a running balance', () => {
    const ledger = [
      entry({ at: 1, playerId: 'a', kind: 'start', points: 500 }),
      entry({ at: 2, playerId: 'a', kind: 'deposit', points: 50 }),
      entry({ at: 3, playerId: 'a', kind: 'withdraw', points: -100 }),
    ]
    const series = pokerBalanceSeriesFromLedger(ledger, [
      { id: 'a', name: 'Alice', color: '#fff' },
    ])
    expect(series).toHaveLength(1)
    expect(series[0]?.samples.map((s) => s.balance)).toEqual([500, 550, 450])
  })

  it('treats claim as a balance replacement, not a delta', () => {
    // After claimSeat remaps seat → claimer, the ledger is one continuous series.
    const ledger = [
      entry({ at: 2, playerId: 'phone', kind: 'start', points: 500 }),
      entry({ at: 3, playerId: 'phone', kind: 'deposit', points: 300 }),
      entry({
        at: 4,
        playerId: 'phone',
        kind: 'claim',
        points: 800,
        meta: { seatId: 'seat' },
      }),
    ]
    const series = pokerBalanceSeriesFromLedger(ledger, [
      { id: 'phone', name: 'Pat', color: '#0f0' },
    ])
    expect(series).toHaveLength(1)
    expect(series[0]?.samples.map((s) => s.balance)).toEqual([500, 800, 800])
  })

  it('adds merged stacks onto the survivor', () => {
    const ledger = [
      entry({ at: 1, playerId: 'a', kind: 'start', points: 100 }),
      entry({ at: 1, playerId: 'b', kind: 'start', points: 250 }),
      entry({
        at: 2,
        playerId: 'b',
        kind: 'merge',
        points: 100,
        meta: { fromId: 'a' },
      }),
    ]
    const series = pokerBalanceSeriesFromLedger(ledger, [
      { id: 'b', name: 'Bob', color: '#00f' },
    ])
    expect(series.find((s) => s.playerId === 'b')?.samples.map((s) => s.balance)).toEqual([
      250, 350,
    ])
  })

  it('forward-fills balances across shared chart rows', () => {
    const series = pokerBalanceSeriesFromLedger([
      entry({ at: 10, playerId: 'a', kind: 'start', points: 500 }),
      entry({ at: 20, playerId: 'b', kind: 'start', points: 400 }),
      entry({ at: 30, playerId: 'a', kind: 'deposit', points: 25 }),
    ])
    const rows = pokerBalanceChartRows(series)
    expect(rows).toEqual([
      { at: 10, a: 500 },
      { at: 20, a: 500, b: 400 },
      { at: 30, a: 525, b: 400 },
    ])
  })

  it('orders series by the live roster, then former players', () => {
    const report = buildPokerBalanceReport(
      {
        ledger: [
          entry({ at: 1, playerId: 'host', kind: 'start', points: 500 }),
          entry({ at: 1, playerId: 'merged', kind: 'start', points: 400 }),
          entry({
            at: 2,
            playerId: 'host',
            kind: 'merge',
            points: 400,
            meta: { fromId: 'merged' },
          }),
        ],
      },
      [
        { id: 'host', name: 'Host', color: '#fbbf24' },
        { id: 'guest', name: 'Gale', color: '#34d399' },
      ],
    )
    // Merged-away players stay as a separate historical series.
    expect(report.series.map((s) => s.playerId)).toEqual(['host', 'merged'])
    expect(report.series[0]?.name).toBe('Host')
    expect(report.series[1]?.name).toBe('Former player')
  })
})
