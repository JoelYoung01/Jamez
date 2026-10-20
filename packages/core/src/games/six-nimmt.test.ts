import { describe, expect, it } from 'vitest'
import type { SessionPlayer } from '../protocol/session-state'
import {
  SIX_NIMMT_DECK_MAX,
  bullheadsOnCard,
  sixNimmtEngine,
  sixNimmtRoundComplete,
  sixNimmtTotals,
  sumBullheads,
  type SixNimmtState,
} from './six-nimmt'

function player(id: string, name = id, isHost = false): SessionPlayer {
  return {
    id,
    name,
    emoji: '🐂',
    color: '#e8a317',
    isHost,
    clientIds: isHost ? [] : [id],
    connected: true,
    joinedAt: 0,
  }
}

const ctxHost = { actorId: 'host', isHost: true, now: 1 }
const ctxOf = (id: string) => ({ actorId: id, isHost: false, now: 1 })

function table(target = 66): SixNimmtState {
  return sixNimmtEngine.init({ targetScore: target }, [
    player('a', 'Ada', true),
    player('b', 'Bea'),
    player('c', 'Cal'),
  ])
}

function scoreAll(state: SixNimmtState, roundIndex: number, scores: Record<string, number>) {
  let next = state
  for (const [playerId, score] of Object.entries(scores)) {
    next = sixNimmtEngine.applyAction(
      next,
      { type: 'setScore', playerId, roundIndex, score },
      ctxHost,
    )
  }
  return next
}

describe('bullheadsOnCard', () => {
  it('follows the Amigo bullhead table', () => {
    expect(bullheadsOnCard(1)).toBe(1)
    expect(bullheadsOnCard(104)).toBe(1)
    expect(bullheadsOnCard(5)).toBe(2)
    expect(bullheadsOnCard(15)).toBe(2)
    expect(bullheadsOnCard(95)).toBe(2)
    expect(bullheadsOnCard(10)).toBe(3)
    expect(bullheadsOnCard(100)).toBe(3)
    expect(bullheadsOnCard(11)).toBe(5)
    expect(bullheadsOnCard(22)).toBe(5)
    expect(bullheadsOnCard(99)).toBe(5)
    expect(bullheadsOnCard(55)).toBe(7)
    expect(bullheadsOnCard(0)).toBeNull()
    expect(bullheadsOnCard(105)).toBeNull()
    expect(bullheadsOnCard(1.5)).toBeNull()
  })

  it('sums a pile and the whole deck', () => {
    expect(sumBullheads([55, 10, 22, 7])).toBe(7 + 3 + 5 + 1)
    expect(sumBullheads([0, 200])).toBe(0)
    const deck = Array.from({ length: SIX_NIMMT_DECK_MAX }, (_, i) => i + 1)
    const byHeads = { 1: 0, 2: 0, 3: 0, 5: 0, 7: 0 }
    for (const card of deck) {
      const heads = bullheadsOnCard(card)!
      byHeads[heads as 1 | 2 | 3 | 5 | 7] += 1
    }
    expect(byHeads).toEqual({ 1: 76, 2: 9, 3: 10, 5: 8, 7: 1 })
    expect(sumBullheads(deck)).toBe(171)
  })
})

describe('six nimmt engine', () => {
  it('starts an empty round for 2–10 players and a target of 66', () => {
    expect(sixNimmtEngine.defaultConfig()).toEqual({ targetScore: 66 })
    expect(sixNimmtEngine.minPlayers).toBe(2)
    expect(sixNimmtEngine.maxPlayers).toBe(10)
    const state = table()
    expect(state.rounds).toHaveLength(1)
    expect(sixNimmtTotals(state)).toEqual({ a: 0, b: 0, c: 0 })
    expect(sixNimmtRoundComplete(state, state.rounds[0]!)).toBe(false)
    expect(sixNimmtEngine.isFinished(state)).toBe(false)
  })

  it('lets a player edit their own bullheads and blocks guests from editing others', () => {
    const state = table()
    const own = { type: 'setScore' as const, playerId: 'a', roundIndex: 0, score: 3 }
    expect(sixNimmtEngine.validateAction(state, own, ctxOf('a'))).toBeNull()
    expect(sixNimmtEngine.validateAction(state, own, ctxOf('b'))).toMatch(/own score/)
    expect(sixNimmtEngine.validateAction(state, { ...own, score: -1 }, ctxHost)).toMatch(/0 to 999/)
    expect(
      sixNimmtEngine.validateAction(state, { type: 'addRound' }, ctxOf('a')),
    ).toMatch(/host/)
  })

  it('ends the round only after every seat is entered, then keeps going under 66', () => {
    let state = scoreAll(table(), 0, { a: 10, b: 4 })
    expect(sixNimmtEngine.isFinished(state)).toBe(false)
    expect(sixNimmtEngine.validateAction(state, { type: 'addRound' }, ctxHost)).toMatch(/current round/)
    state = scoreAll(state, 0, { c: 0 })
    expect(sixNimmtTotals(state)).toEqual({ a: 10, b: 4, c: 0 })
    expect(sixNimmtEngine.isFinished(state)).toBe(false)
    state = sixNimmtEngine.applyAction(state, { type: 'addRound' }, ctxHost)
    expect(state.rounds).toHaveLength(2)
    expect(state.rounds[1]?.scores).toEqual({ a: null, b: null, c: null })
  })

  it('finishes when the closing round puts someone at 66 or more, and the lowest total wins', () => {
    let state = scoreAll(table(), 0, { a: 20, b: 40, c: 5 })
    state = sixNimmtEngine.applyAction(state, { type: 'addRound' }, ctxHost)
    state = scoreAll(state, 1, { a: 8, b: 30, c: 12 })
    expect(sixNimmtTotals(state)).toEqual({ a: 28, b: 70, c: 17 })
    expect(sixNimmtEngine.isFinished(state)).toBe(true)

    const players = [player('a', 'Ada'), player('b', 'Bea'), player('c', 'Cal')]
    const summary = sixNimmtEngine.summary(state, players)
    expect(summary.winnerIds).toEqual(['c'])
    expect(summary.headline).toBe('Cal wins with 17 pts')
    expect(summary.entries.map((e) => e.playerId)).toEqual(['c', 'a', 'b'])
    expect(summary.entries.map((e) => e.rank)).toEqual([1, 2, 3])
  })

  it('waits for the rest of the round before ending, even if one total already crossed 66', () => {
    let state = scoreAll(table(66), 0, { a: 70 })
    expect(sixNimmtEngine.isFinished(state)).toBe(false)
    state = scoreAll(state, 0, { b: 3, c: 3 })
    expect(sixNimmtEngine.isFinished(state)).toBe(true)
    expect(sixNimmtEngine.summary(state, [player('a', 'Ada'), player('b', 'Bea'), player('c', 'Cal')]).winnerIds.sort()).toEqual([
      'b',
      'c',
    ])
  })

  it('shares the win when several players tie for fewest', () => {
    const state = scoreAll(table(10), 0, { a: 12, b: 4, c: 4 })
    const summary = sixNimmtEngine.summary(state, [
      player('a', 'Ada'),
      player('b', 'Bea'),
      player('c', 'Cal'),
    ])
    expect(summary.winnerIds.sort()).toEqual(['b', 'c'])
    expect(summary.headline).toBe('Bea & Cal tie at 4 pts')
    expect(summary.entries.filter((e) => e.rank === 1)).toHaveLength(2)
    expect(summary.entries.find((e) => e.playerId === 'a')?.rank).toBe(3)
  })

  it('undoes a round and supports late join', () => {
    let state = scoreAll(table(), 0, { a: 1, b: 2, c: 3 })
    state = sixNimmtEngine.applyAction(state, { type: 'addRound' }, ctxHost)
    state = sixNimmtEngine.applyAction(state, { type: 'undoRound' }, ctxHost)
    expect(state.rounds).toHaveLength(1)
    expect(sixNimmtTotals(state)).toEqual({ a: 1, b: 2, c: 3 })

    state = sixNimmtEngine.addPlayer!(state, player('d', 'Dee'))
    expect(state.rounds[0]?.scores.d).toBeNull()
    expect(sixNimmtRoundComplete(state, state.rounds[0]!)).toBe(false)
    state = sixNimmtEngine.removePlayer!(state, 'd')
    expect(state.playerIds).not.toContain('d')
  })
})
