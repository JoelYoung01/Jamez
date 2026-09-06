import { describe, expect, it } from 'vitest'
import type { SessionPlayer } from '../protocol/session-state'
import {
  flip7Engine,
  flip7RoundComplete,
  flip7Totals,
  scoreFlip7Round,
  type Flip7State,
} from './flip-7'

function player(id: string, name = id, isHost = false): SessionPlayer {
  return {
    id,
    name,
    emoji: '🃏',
    color: '#30ced5',
    isHost,
    remote: !isHost,
    connected: true,
    joinedAt: 0,
  }
}

const ctxHost = { actorId: 'host', isHost: true, now: 1 }
const ctxOf = (id: string) => ({ actorId: id, isHost: false, now: 1 })

function threePlayerState(target = 200): Flip7State {
  return flip7Engine.init({ targetScore: target }, [
    player('a', 'Ada', true),
    player('b', 'Bea'),
    player('c', 'Cal'),
  ])
}

describe('scoreFlip7Round', () => {
  it('follows official order: numbers, then x2, then +N, then Flip 7 bonus', () => {
    expect(
      scoreFlip7Round({
        numbers: [3, 5, 7, 10],
        plusModifiers: [6],
        timesTwo: true,
        flip7: false,
        busted: false,
      }),
    ).toBe(25 * 2 + 6)

    expect(
      scoreFlip7Round({
        numbers: [0, 1, 2, 3, 4, 5, 6],
        plusModifiers: [],
        timesTwo: true,
        flip7: true,
        busted: false,
      }),
    ).toBe(21 * 2 + 15)

    expect(
      scoreFlip7Round({
        numbers: [12, 11, 10],
        plusModifiers: [10],
        timesTwo: false,
        flip7: false,
        busted: true,
      }),
    ).toBe(0)
  })
})

describe('flip7 engine', () => {
  it('starts with an empty round 1 for every seat', () => {
    const state = threePlayerState()
    expect(state.rounds).toHaveLength(1)
    expect(state.rounds[0]?.n).toBe(1)
    expect(flip7Totals(state)).toEqual({ a: 0, b: 0, c: 0 })
    expect(flip7RoundComplete(state, state.rounds[0]!)).toBe(false)
  })

  it('lets players edit their own round score; host can edit anyone', () => {
    const state = threePlayerState()
    const own = { type: 'setScore' as const, playerId: 'a', roundIndex: 0, score: 42 }
    expect(flip7Engine.validateAction(state, own, ctxOf('a'))).toBeNull()
    expect(flip7Engine.validateAction(state, own, ctxOf('b'))).toMatch(/own score/)
    expect(flip7Engine.validateAction(state, own, ctxHost)).toBeNull()
  })

  it('accumulates totals across rounds and opens the next round when complete', () => {
    let state = threePlayerState()
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 0, score: 40 },
      ctxOf('a'),
    )
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'b', roundIndex: 0, score: 25 },
      ctxOf('b'),
    )
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'c', roundIndex: 0, score: 0 },
      ctxOf('c'),
    )
    expect(flip7RoundComplete(state, state.rounds[0]!)).toBe(true)
    expect(flip7Totals(state)).toEqual({ a: 40, b: 25, c: 0 })

    state = flip7Engine.applyAction(state, { type: 'addRound' }, ctxHost)
    expect(state.rounds).toHaveLength(2)

    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 1, score: 55 },
      ctxOf('a'),
    )
    expect(flip7Totals(state)).toEqual({ a: 95, b: 25, c: 0 })
  })

  it('allows negative round scores (Vengeance-style)', () => {
    let state = threePlayerState()
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 0, score: -10 },
      ctxHost,
    )
    expect(flip7Totals(state).a).toBe(-10)
  })

  it('finishes only once someone hits the target and the final round is complete', () => {
    let state = threePlayerState(50)
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 0, score: 50 },
      ctxHost,
    )
    expect(flip7Engine.isFinished(state)).toBe(false)
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'b', roundIndex: 0, score: 10 },
      ctxHost,
    )
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'c', roundIndex: 0, score: 5 },
      ctxHost,
    )
    expect(flip7Engine.isFinished(state)).toBe(true)

    const players = [player('a', 'Ada'), player('b', 'Bea'), player('c', 'Cal')]
    const summary = flip7Engine.summary(state, players)
    expect(summary.winnerIds).toEqual(['a'])
    expect(summary.headline).toContain('Ada wins')
  })

  it('shares the win on a same-round tie at or above the target', () => {
    let state = threePlayerState(30)
    for (const [id, score] of [
      ['a', 30],
      ['b', 30],
      ['c', 12],
    ] as const) {
      state = flip7Engine.applyAction(
        state,
        { type: 'setScore', playerId: id, roundIndex: 0, score },
        ctxHost,
      )
    }
    const summary = flip7Engine.summary(state, [
      player('a', 'Ada'),
      player('b', 'Bea'),
      player('c', 'Cal'),
    ])
    expect(summary.winnerIds.sort()).toEqual(['a', 'b'])
    expect(summary.entries.filter((e) => e.rank === 1)).toHaveLength(2)
  })

  it('undoes the last round or clears round 1', () => {
    let state = threePlayerState()
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 0, score: 20 },
      ctxHost,
    )
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'b', roundIndex: 0, score: 20 },
      ctxHost,
    )
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'c', roundIndex: 0, score: 20 },
      ctxHost,
    )
    state = flip7Engine.applyAction(state, { type: 'addRound' }, ctxHost)
    expect(state.rounds).toHaveLength(2)
    state = flip7Engine.applyAction(state, { type: 'undoRound' }, ctxHost)
    expect(state.rounds).toHaveLength(1)
    state = flip7Engine.applyAction(state, { type: 'undoRound' }, ctxHost)
    expect(state.rounds[0]?.scores).toEqual({ a: null, b: null, c: null })
  })

  it('supports late join and remove', () => {
    let state = threePlayerState()
    state = flip7Engine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 0, score: 11 },
      ctxHost,
    )
    state = flip7Engine.addPlayer!(state, player('d', 'Dee'))
    expect(state.playerIds).toContain('d')
    expect(state.rounds[0]?.scores.d).toBeNull()
    state = flip7Engine.removePlayer!(state, 'd')
    expect(state.playerIds).not.toContain('d')
    expect(state.rounds[0]?.scores.d).toBeUndefined()
  })
})
