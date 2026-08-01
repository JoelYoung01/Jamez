import { describe, expect, it } from 'vitest'
import type { SessionPlayer } from '../protocol/session-state'
import {
  ginBoxes,
  ginFinalTally,
  ginRummyEngine,
  ginTotals,
  scoreGinHand,
  type GinAction,
  type GinState,
} from './gin-rummy'

function player(id: string, name = id, isHost = false): SessionPlayer {
  return { id, name, emoji: '🃏', color: '#fff', isHost, remote: !isHost, connected: true, joinedAt: 0 }
}

const config = ginRummyEngine.defaultConfig()
const ctxHost = { actorId: 'a', isHost: true, now: 100 }

function freshState(): GinState {
  return ginRummyEngine.init(config, [player('a', 'Alice', true), player('b', 'Bob')])
}

function record(state: GinState, action: Omit<GinAction & { type: 'recordHand' }, 'type'>): GinState {
  const full = { type: 'recordHand', ...action } as GinAction
  const error = ginRummyEngine.validateAction(state, full, ctxHost)
  expect(error).toBeNull()
  return ginRummyEngine.applyAction(state, full, ctxHost)
}

describe('gin rummy hand scoring', () => {
  it('scores a clean knock as the deadwood difference', () => {
    const result = scoreGinHand(config, {
      knockerId: 'a',
      defenderId: 'b',
      outcome: 'knock',
      knockerDeadwood: 4,
      defenderDeadwood: 21,
    })
    expect(result).toEqual({ winnerId: 'a', points: 17, undercut: false })
  })

  it('awards an undercut on equal or lower defender deadwood', () => {
    const equal = scoreGinHand(config, {
      knockerId: 'a',
      defenderId: 'b',
      outcome: 'knock',
      knockerDeadwood: 7,
      defenderDeadwood: 7,
    })
    expect(equal).toEqual({ winnerId: 'b', points: 25, undercut: true })

    const lower = scoreGinHand(config, {
      knockerId: 'a',
      defenderId: 'b',
      outcome: 'knock',
      knockerDeadwood: 9,
      defenderDeadwood: 3,
    })
    expect(lower).toEqual({ winnerId: 'b', points: 6 + 25, undercut: true })
  })

  it('scores gin and big gin with their bonuses', () => {
    expect(
      scoreGinHand(config, {
        knockerId: 'a',
        defenderId: 'b',
        outcome: 'gin',
        knockerDeadwood: 0,
        defenderDeadwood: 18,
      }),
    ).toEqual({ winnerId: 'a', points: 18 + 25, undercut: false })
    expect(
      scoreGinHand(config, {
        knockerId: 'a',
        defenderId: 'b',
        outcome: 'bigGin',
        knockerDeadwood: 0,
        defenderDeadwood: 40,
      }),
    ).toEqual({ winnerId: 'a', points: 40 + 31, undercut: false })
  })
})

describe('gin rummy engine', () => {
  it('validates knock deadwood limits', () => {
    const state = freshState()
    expect(
      ginRummyEngine.validateAction(
        state,
        { type: 'recordHand', knockerId: 'a', outcome: 'knock', knockerDeadwood: 11, defenderDeadwood: 5 },
        ctxHost,
      ),
    ).toMatch(/10 or less/)
    expect(
      ginRummyEngine.validateAction(
        state,
        { type: 'recordHand', knockerId: 'a', outcome: 'knock', knockerDeadwood: 0, defenderDeadwood: 5 },
        ctxHost,
      ),
    ).toMatch(/gin/i)
    expect(
      ginRummyEngine.validateAction(
        state,
        { type: 'recordHand', knockerId: 'a', outcome: 'gin', knockerDeadwood: 3, defenderDeadwood: 5 },
        ctxHost,
      ),
    ).toMatch(/zero deadwood/)
  })

  it('rotates the deal to the loser of each hand', () => {
    let state = freshState()
    expect(state.dealerId).toBe('a')
    state = record(state, { knockerId: 'a', outcome: 'knock', knockerDeadwood: 2, defenderDeadwood: 20 })
    expect(state.dealerId).toBe('b') // Bob lost, Bob deals
    state = record(state, { knockerId: 'b', outcome: 'knock', knockerDeadwood: 5, defenderDeadwood: 4 })
    expect(state.dealerId).toBe('b') // Bob got undercut, Bob deals again
  })

  it('tracks running totals and boxes, and finishes at the target', () => {
    let state = freshState()
    state = record(state, { knockerId: 'a', outcome: 'gin', knockerDeadwood: 0, defenderDeadwood: 30 }) // a +55
    state = record(state, { knockerId: 'b', outcome: 'knock', knockerDeadwood: 3, defenderDeadwood: 25 }) // b +22
    expect(ginTotals(state)).toEqual({ a: 55, b: 22 })
    expect(ginBoxes(state)).toEqual({ a: 1, b: 1 })
    expect(ginRummyEngine.isFinished(state)).toBe(false)

    state = record(state, { knockerId: 'a', outcome: 'bigGin', knockerDeadwood: 0, defenderDeadwood: 14 }) // a +45 -> 100
    expect(ginRummyEngine.isFinished(state)).toBe(true)

    const tally = ginFinalTally(state)
    const alice = tally.find((t) => t.playerId === 'a')!
    const bob = tally.find((t) => t.playerId === 'b')!
    expect(alice.handPoints).toBe(100)
    expect(alice.lineBonusTotal).toBe(50) // 2 boxes x 25
    expect(alice.gameBonus).toBe(100)
    expect(alice.finalScore).toBe(250)
    expect(bob.finalScore).toBe(22 + 25)

    const summary = ginRummyEngine.summary(state, [player('a', 'Alice', true), player('b', 'Bob')])
    expect(summary.winnerIds).toEqual(['a'])
    expect(summary.headline).toBe('Alice wins the match 250 – 47')
  })

  it('doubles the game bonus on a shutout', () => {
    let state = freshState()
    state = record(state, { knockerId: 'a', outcome: 'gin', knockerDeadwood: 0, defenderDeadwood: 80 }) // a +105
    const tally = ginFinalTally(state)
    const alice = tally.find((t) => t.playerId === 'a')!
    expect(alice.gameBonus).toBe(200)
    expect(alice.finalScore).toBe(105 + 25 + 200)
  })

  it('applies line bonuses but no game bonus when ended early', () => {
    let state = freshState()
    state = record(state, { knockerId: 'b', outcome: 'knock', knockerDeadwood: 1, defenderDeadwood: 9 }) // b +8
    const tally = ginFinalTally(state)
    const bob = tally.find((t) => t.playerId === 'b')!
    expect(bob.gameBonus).toBe(0)
    expect(bob.finalScore).toBe(8 + 25)
    const summary = ginRummyEngine.summary(state, [player('a', 'Alice', true), player('b', 'Bob')])
    expect(summary.headline).toBe('Bob leads 33 – 0')
  })

  it('undo restores the previous hand and dealer', () => {
    let state = freshState()
    state = record(state, { knockerId: 'a', outcome: 'knock', knockerDeadwood: 2, defenderDeadwood: 12 })
    state = record(state, { knockerId: 'b', outcome: 'gin', knockerDeadwood: 0, defenderDeadwood: 22 })
    expect(state.hands).toHaveLength(2)
    expect(state.dealerId).toBe('a')

    expect(ginRummyEngine.validateAction(state, { type: 'undoHand' }, { actorId: 'b', isHost: false, now: 0 })).toMatch(
      /host/,
    )
    state = ginRummyEngine.applyAction(state, { type: 'undoHand' }, ctxHost)
    expect(state.hands).toHaveLength(1)
    expect(state.dealerId).toBe('b')
  })
})
