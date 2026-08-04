import { describe, expect, it } from 'vitest'
import type { SessionPlayer } from '../protocol/session-state'
import { wingspanEngine, wingspanRanking, wingspanTotal, type WingspanState } from './wingspan'

function player(id: string, name = id, isHost = false): SessionPlayer {
  return { id, name, emoji: '🐦', color: '#fff', isHost, remote: !isHost, connected: true, joinedAt: 0 }
}

const ctxHost = { actorId: 'host', isHost: true, now: 0 }
const ctxOf = (id: string) => ({ actorId: id, isHost: false, now: 0 })

describe('wingspan scoring', () => {
  it('totals all base-game categories', () => {
    const sheet = {
      birds: 45,
      bonusCards: 11,
      roundGoals: 14,
      eggs: 12,
      foodOnCards: 3,
      tuckedCards: 6,
      nectar: 9,
      unusedFood: 2,
      done: false,
    }
    expect(wingspanTotal(sheet, { nectar: false })).toBe(45 + 11 + 14 + 12 + 3 + 6)
    expect(wingspanTotal(sheet, { nectar: true })).toBe(45 + 11 + 14 + 12 + 3 + 6 + 9)
  })

  it('ranks players and breaks ties with unused food', () => {
    let state = wingspanEngine.init({ nectar: false }, [player('a'), player('b'), player('c')])
    const set = (playerId: string, category: string, value: number) => {
      state = wingspanEngine.applyAction(
        state,
        { type: 'setCategory', playerId, category: category as never, value },
        ctxHost,
      )
    }
    set('a', 'birds', 50)
    set('b', 'birds', 50)
    set('c', 'birds', 40)
    set('a', 'unusedFood', 3)
    set('b', 'unusedFood', 1)

    const ranking = wingspanRanking(state)
    expect(ranking.map((r) => [r.playerId, r.rank])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
  })

  it('shares the win when score and tiebreaker are both tied', () => {
    let state = wingspanEngine.init({ nectar: false }, [player('a', 'Robin'), player('b', 'Jay')])
    state = wingspanEngine.applyAction(
      state,
      { type: 'setCategory', playerId: 'a', category: 'birds', value: 33 },
      ctxHost,
    )
    state = wingspanEngine.applyAction(
      state,
      { type: 'setCategory', playerId: 'b', category: 'eggs', value: 33 },
      ctxHost,
    )
    const summary = wingspanEngine.summary(state, [player('a', 'Robin'), player('b', 'Jay')])
    expect(summary.winnerIds.sort()).toEqual(['a', 'b'])
    expect(summary.headline).toContain('Robin & Jay')
    expect(summary.entries.every((e) => e.rank === 1)).toBe(true)
  })

  it('only lets players edit their own sheet unless host', () => {
    const state = wingspanEngine.init({ nectar: false }, [player('a'), player('b')])
    const action = { type: 'setCategory', playerId: 'a', category: 'eggs', value: 5 } as const
    expect(wingspanEngine.validateAction(state, action, ctxOf('b'))).toMatch(/own sheet/)
    expect(wingspanEngine.validateAction(state, action, ctxOf('a'))).toBeNull()
    expect(wingspanEngine.validateAction(state, action, ctxHost)).toBeNull()
  })

  it('rejects nectar when the expansion is off, invalid values always', () => {
    const state = wingspanEngine.init({ nectar: false }, [player('a')])
    expect(
      wingspanEngine.validateAction(
        state,
        { type: 'setCategory', playerId: 'a', category: 'nectar', value: 5 },
        ctxOf('a'),
      ),
    ).toMatch(/Nectar/)
    expect(
      wingspanEngine.validateAction(
        state,
        { type: 'setCategory', playerId: 'a', category: 'eggs', value: -1 },
        ctxOf('a'),
      ),
    ).toMatch(/negative/)
    expect(
      wingspanEngine.validateAction(
        state,
        { type: 'setCategory', playerId: 'a', category: 'eggs', value: 2.5 },
        ctxOf('a'),
      ),
    ).toMatch(/whole number/)
  })

  it('supports late joins and removals', () => {
    let state: WingspanState = wingspanEngine.init({ nectar: false }, [player('a')])
    state = wingspanEngine.addPlayer!(state, player('late'))
    expect(Object.keys(state.sheets).sort()).toEqual(['a', 'late'])
    state = wingspanEngine.removePlayer!(state, 'a')
    expect(Object.keys(state.sheets)).toEqual(['late'])
  })
})
