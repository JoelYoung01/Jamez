import { describe, expect, it } from 'vitest'
import type { SessionPlayer } from '../protocol/session-state'
import {
  cribbageEngine,
  cribbageIsSkunk,
  cribbageTotals,
  scoreCribbageHand,
  type CribbageAction,
  type CribbageCard,
  type CribbageState,
} from './cribbage'

function player(id: string, name = id, isHost = false): SessionPlayer {
  return { id, name, emoji: '🃏', color: '#fff', isHost, remote: !isHost, connected: true, joinedAt: 0 }
}

function card(rank: CribbageCard['rank'], suit: CribbageCard['suit']): CribbageCard {
  return { rank, suit }
}

const config = cribbageEngine.defaultConfig()
const ctxHost = { actorId: 'a', isHost: true, now: 100 }
const ctxGuest = { actorId: 'b', isHost: false, now: 100 }

function freshState(overrides?: Partial<typeof config>): CribbageState {
  return cribbageEngine.init({ ...config, ...overrides }, [
    player('a', 'Alice', true),
    player('b', 'Bob'),
  ])
}

function peg(
  state: CribbageState,
  action: Omit<CribbageAction & { type: 'peg' }, 'type'>,
  ctx = ctxHost,
): CribbageState {
  const full = { type: 'peg', ...action } as CribbageAction
  const error = cribbageEngine.validateAction(state, full, ctx)
  expect(error).toBeNull()
  return cribbageEngine.applyAction(state, full, ctx)
}

describe('cribbage hand scoring (Bicycle)', () => {
  it('scores the classic 8-7-7-6-2 hand as 16', () => {
    // Bicycle example: four 15s (8), pair of 7s (2), two runs of three (6) = 16
    const result = scoreCribbageHand(
      [card('8', 'H'), card('7', 'S'), card('7', 'D'), card('6', 'C')],
      card('2', 'H'),
    )
    expect(result).toEqual({
      fifteens: 8,
      pairs: 2,
      runs: 6,
      flush: 0,
      nobs: 0,
      total: 16,
    })
  })

  it('scores a perfect 29', () => {
    // Starter 5; three more 5s + Jack matching starter suit
    const result = scoreCribbageHand(
      [card('5', 'H'), card('5', 'S'), card('5', 'D'), card('J', 'C')],
      card('5', 'C'),
    )
    expect(result.nobs).toBe(1)
    expect(result.pairs).toBe(12) // double pair royal
    expect(result.fifteens).toBe(16) // four triple-5 fifteens + four Jack+5
    expect(result.total).toBe(29)
  })

  it('scores a non-crib flush of 4 and 5', () => {
    // Face-heavy hand avoids fifteens and runs.
    const four = scoreCribbageHand(
      [card('Q', 'H'), card('K', 'H'), card('9', 'H'), card('2', 'H')],
      card('A', 'S'),
    )
    expect(four.flush).toBe(4)
    expect(four.fifteens).toBe(0)
    expect(four.runs).toBe(0)
    expect(four.total).toBe(4)

    const five = scoreCribbageHand(
      [card('Q', 'H'), card('K', 'H'), card('9', 'H'), card('2', 'H')],
      card('A', 'H'),
    )
    expect(five.flush).toBe(5)
    expect(five.total).toBe(5)
  })

  it('only scores a crib flush when all five cards match', () => {
    const noFlush = scoreCribbageHand(
      [card('2', 'H'), card('4', 'H'), card('9', 'H'), card('K', 'H')],
      card('A', 'S'),
      { isCrib: true },
    )
    expect(noFlush.flush).toBe(0)

    const fullFlush = scoreCribbageHand(
      [card('2', 'H'), card('4', 'H'), card('9', 'H'), card('K', 'H')],
      card('A', 'H'),
      { isCrib: true },
    )
    expect(fullFlush.flush).toBe(5)
  })

  it('keeps ace low — no wraparound run with king', () => {
    const result = scoreCribbageHand(
      [card('Q', 'H'), card('K', 'S'), card('A', 'D'), card('2', 'C')],
      card('3', 'H'),
    )
    // Run is A-2-3 only (3 pts); Q-K is not a run of 3+
    expect(result.runs).toBe(3)
  })

  it('awards His Nobs for a jack matching the starter suit', () => {
    const result = scoreCribbageHand(
      [card('J', 'S'), card('Q', 'H'), card('K', 'D'), card('9', 'C')],
      card('2', 'S'),
    )
    expect(result.nobs).toBe(1)
    expect(result.runs).toBe(3) // J-Q-K
    expect(result.fifteens).toBe(0)
    expect(result.total).toBe(4)
  })
})

describe('cribbage engine', () => {
  it('defaults to Bicycle 121 with a 61 skunk line', () => {
    expect(config).toEqual({ targetScore: 121, skunkLine: 61 })
  })

  it('lets the host peg for anyone and guests only for themselves', () => {
    const state = freshState()
    expect(
      cribbageEngine.validateAction(
        state,
        { type: 'peg', playerId: 'a', points: 2, kind: 'fifteen' },
        ctxGuest,
      ),
    ).toMatch(/yourself/)
    expect(
      cribbageEngine.validateAction(
        state,
        { type: 'peg', playerId: 'b', points: 2, kind: 'fifteen' },
        ctxGuest,
      ),
    ).toBeNull()
  })

  it('rejects invalid peg sizes', () => {
    const state = freshState()
    expect(
      cribbageEngine.validateAction(state, { type: 'peg', playerId: 'a', points: 0 }, ctxHost),
    ).toMatch(/at least 1/)
    expect(
      cribbageEngine.validateAction(state, { type: 'peg', playerId: 'a', points: 41 }, ctxHost),
    ).toMatch(/too large/)
  })

  it('tracks pegs, rotates the deal, and undoes', () => {
    let state = freshState()
    expect(state.dealerId).toBe('a')
    state = peg(state, { playerId: 'a', points: 2, kind: 'heels' })
    state = peg(state, { playerId: 'b', points: 2, kind: 'fifteen' }, ctxGuest)
    expect(cribbageTotals(state)).toEqual({ a: 2, b: 2 })

    state = cribbageEngine.applyAction(state, { type: 'nextDeal' }, ctxHost)
    expect(state.dealerId).toBe('b')

    state = cribbageEngine.applyAction(state, { type: 'undoPeg' }, ctxHost)
    expect(cribbageTotals(state)).toEqual({ a: 2, b: 0 })
    expect(
      cribbageEngine.validateAction(state, { type: 'undoPeg' }, ctxGuest),
    ).toMatch(/host/)
  })

  it('finishes at the target and flags a skunk / lurch', () => {
    let state = freshState({ targetScore: 121, skunkLine: 61 })
    // Alice races past 121 while Bob is still short of 61.
    state = peg(state, { playerId: 'a', points: 29, kind: 'hand' })
    state = peg(state, { playerId: 'a', points: 29, kind: 'hand' })
    state = peg(state, { playerId: 'a', points: 29, kind: 'hand' })
    state = peg(state, { playerId: 'a', points: 29, kind: 'crib' })
    state = peg(state, { playerId: 'a', points: 5, kind: 'go' }) // 121
    state = peg(state, { playerId: 'b', points: 40, kind: 'hand' })
    expect(cribbageEngine.isFinished(state)).toBe(true)
    expect(cribbageIsSkunk(state)).toBe(true)

    const summary = cribbageEngine.summary(state, [
      player('a', 'Alice', true),
      player('b', 'Bob'),
    ])
    expect(summary.winnerIds).toEqual(['a'])
    expect(summary.headline).toBe('Alice skunks Bob 121 – 40')
    expect(summary.entries.find((e) => e.playerId === 'b')?.scoreText).toMatch(/lurched/)
  })

  it('does not skunk when the loser cleared the line', () => {
    let state = freshState({ targetScore: 61, skunkLine: 31 })
    state = peg(state, { playerId: 'a', points: 30, kind: 'hand' })
    state = peg(state, { playerId: 'a', points: 31, kind: 'crib' })
    state = peg(state, { playerId: 'b', points: 40, kind: 'hand' })
    expect(cribbageEngine.isFinished(state)).toBe(true)
    expect(cribbageIsSkunk(state)).toBe(false)
    const summary = cribbageEngine.summary(state, [
      player('a', 'Alice', true),
      player('b', 'Bob'),
    ])
    expect(summary.headline).toBe('Alice wins 61 – 40')
  })

  it('supports a shorter 61-point game from setup', () => {
    const state = freshState({ targetScore: 61, skunkLine: 31 })
    expect(state.config.targetScore).toBe(61)
    expect(cribbageEngine.isFinished(peg(state, { playerId: 'a', points: 29, kind: 'hand' }))).toBe(
      false,
    )
  })
})
