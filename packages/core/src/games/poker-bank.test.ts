import { describe, expect, it } from 'vitest'
import type { SessionPlayer } from '../protocol/session-state'
import {
  chipBreakdown,
  clonePokerBankConfig,
  formatPokerAmount,
  pointsFromChipCounts,
  pokerBankConfigFromSession,
  pokerBankEngine,
  toPoints,
  type PokerBankState,
} from './poker-bank'

function player(id: string, name: string, remote = false): SessionPlayer {
  return {
    id,
    name,
    emoji: '🃏',
    color: '#fff',
    isHost: id === 'host',
    remote,
    connected: true,
    joinedAt: 1,
  }
}

function started(...players: SessionPlayer[]): PokerBankState {
  return pokerBankEngine.init(pokerBankEngine.defaultConfig(), players)
}

describe('poker bank engine', () => {
  it('grants starting stacks on init and late join', () => {
    const host = player('host', 'Host')
    const state = started(host)
    expect(state.banks.host?.balance).toBe(500)

    const next = pokerBankEngine.addPlayer!(state, player('g1', 'Gale', true))
    expect(next.banks.g1?.balance).toBe(500)
    expect(next.ledger.filter((e) => e.kind === 'start')).toHaveLength(2)
  })

  it('converts dollars using pointsPerDollar', () => {
    expect(toPoints(10, 'dollars', 5)).toBe(50)
    expect(toPoints(10, 'points', 5)).toBe(10)
    // Fractional rates / dollar cents must not round to zero points.
    expect(toPoints(1, 'dollars', 0.25)).toBe(0.25)
    expect(toPoints(0.25, 'dollars', 1)).toBe(0.25)
    expect(toPoints(4, 'dollars', 0.25)).toBe(1)
  })

  it('accepts dollar deposits that convert to fractional points', () => {
    const host = player('host', 'Host')
    let state = pokerBankEngine.init(
      { ...pokerBankEngine.defaultConfig(), pointsPerDollar: 0.25, currencyMode: 'dollars' },
      [host],
    )
    const ctx = { actorId: 'host', isHost: true, now: 100 }
    expect(
      pokerBankEngine.validateAction(
        state,
        { type: 'deposit', playerId: 'host', amount: 1, unit: 'dollars' },
        ctx,
      ),
    ).toBeNull()
    state = pokerBankEngine.applyAction(
      state,
      { type: 'deposit', playerId: 'host', amount: 1, unit: 'dollars' },
      ctx,
    )
    expect(state.banks.host?.balance).toBe(500.25)
  })

  it('deposits and withdraws with chip-friendly balances', () => {
    const host = player('host', 'Host')
    const g1 = player('g1', 'Gale', true)
    let state = started(host, g1)
    const ctx = { actorId: 'g1', isHost: false, now: 100 }

    expect(pokerBankEngine.validateAction(state, { type: 'deposit', playerId: 'g1', amount: 25, unit: 'points' }, ctx)).toBeNull()
    state = pokerBankEngine.applyAction(
      state,
      { type: 'deposit', playerId: 'g1', amount: 25, unit: 'points' },
      ctx,
    )
    expect(state.banks.g1?.balance).toBe(525)

    state = pokerBankEngine.applyAction(
      state,
      { type: 'withdraw', playerId: 'g1', amount: 100, unit: 'points' },
      ctx,
    )
    expect(state.banks.g1?.balance).toBe(425)
    expect(
      pokerBankEngine.validateAction(
        state,
        { type: 'withdraw', playerId: 'g1', amount: 1000, unit: 'points' },
        ctx,
      ),
    ).toBe('Not enough balance')
  })

  it('lets only the host edit another player or update config', () => {
    const host = player('host', 'Host')
    const g1 = player('g1', 'Gale', true)
    const state = started(host, g1)
    const guestCtx = { actorId: 'g1', isHost: false, now: 1 }
    const hostCtx = { actorId: 'host', isHost: true, now: 1 }

    expect(
      pokerBankEngine.validateAction(
        state,
        { type: 'deposit', playerId: 'host', amount: 10, unit: 'points' },
        guestCtx,
      ),
    ).toBe('You can only cash in or out for yourself')

    expect(
      pokerBankEngine.validateAction(
        state,
        { type: 'deposit', playerId: 'host', amount: 10, unit: 'points' },
        hostCtx,
      ),
    ).toBeNull()

    expect(
      pokerBankEngine.validateAction(
        state,
        { type: 'updateConfig', config: { startingStack: 200 } },
        guestCtx,
      ),
    ).toBe('Only the host can update bank settings')

    const next = pokerBankEngine.applyAction(
      state,
      {
        type: 'updateConfig',
        config: {
          currencyMode: 'dollars',
          pointsPerDollar: 4,
          startingStack: 200,
          chips: [
            { id: 'gold', label: 'Gold', value: 50, color: '#f59e0b' },
          ],
        },
      },
      hostCtx,
    )
    expect(next.config.currencyMode).toBe('dollars')
    expect(next.config.pointsPerDollar).toBe(4)
    expect(next.config.startingStack).toBe(200)
    expect(next.config.chips).toHaveLength(1)
    expect(next.config.chips[0]?.id).toBe('gold')
    // Existing balances stay in points; display mode is independent.
    expect(next.banks.g1?.balance).toBe(state.banks.g1?.balance)
  })

  it('claims a seat by replacing the claimer balance', () => {
    const host = player('host', 'Host')
    const seat = player('seat', 'Empty Seat')
    const claimer = player('phone', 'Pat', true)
    let state = started(host, seat)
    state = {
      ...state,
      banks: {
        ...state.banks,
        seat: { balance: 800 },
        phone: { balance: 500 },
      },
    }
    const claimed = pokerBankEngine.claimSeat!(state, 'seat', 'phone')
    expect(claimed.banks.phone?.balance).toBe(800)
    expect(claimed.banks.seat).toBeUndefined()
    expect(claimed.ledger.at(-1)?.kind).toBe('claim')
    // Seat history is remapped onto the claimer; claimer's pre-claim rows drop.
    expect(claimed.ledger.every((e) => e.playerId !== 'seat')).toBe(true)
    expect(claimed.ledger.filter((e) => e.playerId === 'phone' && e.kind === 'start')).toHaveLength(
      1,
    )
    expect(claimed.ledger.find((e) => e.kind === 'start' && e.playerId === 'phone')?.points).toBe(
      500,
    )
  })

  it('keeps merged-away player ledger rows separate', () => {
    const host = player('host', 'Host')
    const a = player('a', 'A', true)
    const b = player('b', 'B', true)
    let state = started(host, a, b)
    state = {
      ...state,
      banks: { ...state.banks, a: { balance: 100 }, b: { balance: 250 } },
    }
    const merged = pokerBankEngine.mergePlayers!(state, 'a', 'b')
    // Source rows stay under fromId so history does not stitch into the survivor.
    expect(merged.ledger.some((e) => e.playerId === 'a')).toBe(true)
    expect(merged.ledger.at(-1)).toMatchObject({ kind: 'merge', playerId: 'b', points: 100 })
  })

  it('merges balances into the survivor', () => {
    const host = player('host', 'Host')
    const a = player('a', 'A', true)
    const b = player('b', 'B', true)
    let state = started(host, a, b)
    state = {
      ...state,
      banks: { ...state.banks, a: { balance: 100 }, b: { balance: 250 } },
    }
    const merged = pokerBankEngine.mergePlayers!(state, 'a', 'b')
    expect(merged.banks.b?.balance).toBe(350)
    expect(merged.banks.a).toBeUndefined()
  })

  it('breaks amounts into chips greedily', () => {
    const chips = pokerBankEngine.defaultConfig().chips
    expect(chips.map((c) => [c.id, c.value])).toEqual([
      ['white', 1],
      ['red', 5],
      ['green', 25],
      ['blue', 100],
      ['black', 500],
      ['purple', 1000],
    ])
    const parts = chipBreakdown(137, chips)
    expect(parts.map((p) => [p.chip.id, p.count])).toEqual([
      ['blue', 1],
      ['green', 1],
      ['red', 2],
      ['white', 2],
    ])
  })

  it('sums chip counts into points', () => {
    const chips = pokerBankEngine.defaultConfig().chips
    expect(
      pointsFromChipCounts(
        { white: 2, red: 2, green: 1, blue: 1, black: 0, purple: 0 },
        chips,
      ),
    ).toBe(137)
    expect(pointsFromChipCounts({ red: 3 }, chips)).toBe(15)
    expect(pointsFromChipCounts({}, chips)).toBe(0)
  })

  it('formats dollars and points', () => {
    expect(formatPokerAmount(500, { currencyMode: 'points', pointsPerDollar: 1 })).toBe('500 pts')
    expect(formatPokerAmount(500, { currencyMode: 'dollars', pointsPerDollar: 1 })).toBe('$500')
    expect(formatPokerAmount(500, { currencyMode: 'dollars', pointsPerDollar: 2 })).toBe('$250')
  })

  it('never auto-finishes', () => {
    expect(pokerBankEngine.isFinished(started(player('host', 'Host')))).toBe(false)
  })

  it('reads config from live game state ahead of lobby gameConfig', () => {
    const lobby = pokerBankEngine.defaultConfig()
    const live = clonePokerBankConfig(lobby)
    live.startingStack = 999
    live.currencyMode = 'dollars'
    expect(
      pokerBankConfigFromSession({
        gameId: 'poker-bank',
        gameConfig: lobby,
        game: { config: live, banks: {}, ledger: [] },
      })?.startingStack,
    ).toBe(999)
    expect(
      pokerBankConfigFromSession({
        gameId: 'poker-bank',
        gameConfig: lobby,
        game: null,
      })?.startingStack,
    ).toBe(500)
    expect(pokerBankConfigFromSession({ gameId: 'wingspan', gameConfig: lobby })).toBeNull()
  })
})
