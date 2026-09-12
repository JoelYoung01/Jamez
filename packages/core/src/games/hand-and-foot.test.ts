import { describe, expect, it } from 'vitest'
import {
  handAndFootEngine,
  handAndFootRoundComplete,
  handAndFootTotals,
  scoreHandAndFootRound,
  type HandAndFootState,
} from './hand-and-foot'
import type { ActionContext } from './types'
import type { SessionPlayer } from '../protocol/session-state'

function player(id: string, name: string): SessionPlayer {
  return {
    id,
    name,
    emoji: '🦶',
    color: '#d4524a',
    isHost: id === 'a',
    remote: id !== 'a',
    connected: true,
    joinedAt: 0,
  }
}

const ctxOf = (actorId: string): ActionContext => ({
  actorId,
  isHost: false,
  now: 1,
})
const ctxHost: ActionContext = { actorId: 'a', isHost: true, now: 1 }

function twoPlayerState(target = 10_000): HandAndFootState {
  return handAndFootEngine.init({ targetScore: target }, [
    player('a', 'Alice'),
    player('b', 'Bob'),
  ])
}

describe('scoreHandAndFootRound', () => {
  it('adds book bonuses, red threes, going out, and card points, then subtracts cards left', () => {
    expect(
      scoreHandAndFootRound({
        cleanBooks: 2,
        dirtyBooks: 1,
        wildBooks: 0,
        redThrees: 3,
        wentOut: true,
        cardPoints: 240,
        cardsLeft: 40,
      }),
    ).toBe(2 * 500 + 300 + 3 * 100 + 100 + 240 - 40)

    expect(
      scoreHandAndFootRound({
        cleanBooks: 0,
        dirtyBooks: 0,
        wildBooks: 1,
        redThrees: -2,
        wentOut: false,
        cardPoints: 0,
        cardsLeft: 50,
      }),
    ).toBe(1500 - 200 - 50)
  })
})

describe('hand and foot engine', () => {
  it('starts with empty round totals', () => {
    const state = twoPlayerState()
    expect(handAndFootTotals(state)).toEqual({ a: 0, b: 0 })
    expect(handAndFootRoundComplete(state, state.rounds[0]!)).toBe(false)
  })

  it('lets guests edit only their own score; host can edit anyone', () => {
    const state = twoPlayerState()
    const own = { type: 'setScore' as const, playerId: 'a', roundIndex: 0, score: 1200 }
    expect(handAndFootEngine.validateAction(state, own, ctxOf('a'))).toBeNull()
    expect(handAndFootEngine.validateAction(state, own, ctxOf('b'))).toMatch(/own score/)
    expect(handAndFootEngine.validateAction(state, own, ctxHost)).toBeNull()
  })

  it('accumulates rounds and finishes when someone reaches the target', () => {
    let state = twoPlayerState(5000)
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 0, score: 2800 },
      ctxHost,
    )
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', playerId: 'b', roundIndex: 0, score: 1900 },
      ctxHost,
    )
    expect(handAndFootRoundComplete(state, state.rounds[0]!)).toBe(true)
    expect(handAndFootTotals(state)).toEqual({ a: 2800, b: 1900 })
    expect(handAndFootEngine.isFinished(state)).toBe(false)

    state = handAndFootEngine.applyAction(state, { type: 'addRound' }, ctxHost)
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 1, score: 2300 },
      ctxHost,
    )
    expect(handAndFootEngine.isFinished(state)).toBe(false)
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', playerId: 'b', roundIndex: 1, score: 1100 },
      ctxHost,
    )
    expect(handAndFootTotals(state)).toEqual({ a: 5100, b: 3000 })
    expect(handAndFootEngine.isFinished(state)).toBe(true)

    const summary = handAndFootEngine.summary(state, [
      player('a', 'Alice'),
      player('b', 'Bob'),
    ])
    expect(summary.winnerIds).toEqual(['a'])
    expect(summary.entries[0]?.score).toBe(5100)
  })

  it('supports negative round scores (cards left / red three penalties)', () => {
    let state = twoPlayerState()
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 0, score: -350 },
      ctxHost,
    )
    expect(handAndFootTotals(state).a).toBe(-350)
  })

  it('undoes the latest round and clears the first when alone', () => {
    let state = twoPlayerState()
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 0, score: 900 },
      ctxHost,
    )
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', playerId: 'b', roundIndex: 0, score: 800 },
      ctxHost,
    )
    state = handAndFootEngine.applyAction(state, { type: 'addRound' }, ctxHost)
    expect(state.rounds).toHaveLength(2)
    state = handAndFootEngine.applyAction(state, { type: 'undoRound' }, ctxHost)
    expect(state.rounds).toHaveLength(1)
    state = handAndFootEngine.applyAction(state, { type: 'undoRound' }, ctxHost)
    expect(state.rounds[0]?.scores).toEqual({ a: null, b: null })
  })

  it('adds and removes late-joining players on the scoresheet', () => {
    let state = twoPlayerState()
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', playerId: 'a', roundIndex: 0, score: 100 },
      ctxHost,
    )
    state = handAndFootEngine.addPlayer!(state, player('c', 'Cara'))
    expect(state.playerIds).toEqual(['a', 'b', 'c'])
    expect(state.rounds[0]?.scores.c).toBeNull()
    state = handAndFootEngine.removePlayer!(state, 'c')
    expect(state.playerIds).toEqual(['a', 'b'])
    expect(state.rounds[0]?.scores.c).toBeUndefined()
  })
})
