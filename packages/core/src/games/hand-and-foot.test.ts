import { describe, expect, it } from 'vitest'
import {
  buildHandAndFootTeams,
  handAndFootEngine,
  handAndFootRoundComplete,
  handAndFootTotals,
  scoreHandAndFootRound,
  teamIdForPlayer,
  teamLabel,
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

function fourPlayerPartnership(target = 10_000): HandAndFootState {
  return handAndFootEngine.init({ targetScore: target, playersPerTeam: 2 }, [
    player('a', 'Alice'),
    player('b', 'Bob'),
    player('c', 'Cara'),
    player('d', 'Dee'),
  ])
}

function cutthroatTwo(target = 10_000): HandAndFootState {
  return handAndFootEngine.init({ targetScore: target, playersPerTeam: 1 }, [
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
  })
})

describe('buildHandAndFootTeams', () => {
  it('builds partnerships of two and cutthroat singles', () => {
    const four = [player('a', 'A'), player('b', 'B'), player('c', 'C'), player('d', 'D')]
    const pairs = buildHandAndFootTeams(four, 2)
    expect(pairs).toHaveLength(2)
    expect(pairs[0]?.playerIds).toEqual(['a', 'b'])
    expect(pairs[1]?.playerIds).toEqual(['c', 'd'])

    const solo = buildHandAndFootTeams(four.slice(0, 2), 1)
    expect(solo).toHaveLength(2)
    expect(solo[0]?.playerIds).toEqual(['a'])
    expect(solo[1]?.playerIds).toEqual(['b'])
  })
})

describe('hand and foot teams engine', () => {
  it('scores by team and labels teams from member names', () => {
    const state = fourPlayerPartnership()
    expect(state.teams).toHaveLength(2)
    expect(handAndFootTotals(state)[state.teams[0]!.id]).toBe(0)
    expect(teamLabel(state.teams[0]!, [player('a', 'Alice'), player('b', 'Bob')])).toBe(
      'Alice & Bob',
    )
  })

  it('lets team members edit their team; host can edit any team', () => {
    const state = fourPlayerPartnership()
    const teamA = state.teams[0]!
    const own = { type: 'setScore' as const, teamId: teamA.id, roundIndex: 0, score: 1200 }
    expect(handAndFootEngine.validateAction(state, own, ctxOf('a'))).toBeNull()
    expect(handAndFootEngine.validateAction(state, own, ctxOf('b'))).toBeNull()
    expect(handAndFootEngine.validateAction(state, own, ctxOf('c'))).toMatch(/own team/)
    expect(handAndFootEngine.validateAction(state, own, ctxHost)).toBeNull()
  })

  it('accumulates team rounds and finishes when a team reaches the target', () => {
    let state = fourPlayerPartnership(5000)
    const [teamA, teamB] = state.teams
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', teamId: teamA!.id, roundIndex: 0, score: 2800 },
      ctxHost,
    )
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', teamId: teamB!.id, roundIndex: 0, score: 1900 },
      ctxHost,
    )
    expect(handAndFootRoundComplete(state, state.rounds[0]!)).toBe(true)
    expect(handAndFootEngine.isFinished(state)).toBe(false)

    state = handAndFootEngine.applyAction(state, { type: 'addRound' }, ctxHost)
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', teamId: teamA!.id, roundIndex: 1, score: 2300 },
      ctxHost,
    )
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', teamId: teamB!.id, roundIndex: 1, score: 1100 },
      ctxHost,
    )
    expect(handAndFootTotals(state)[teamA!.id]).toBe(5100)
    expect(handAndFootEngine.isFinished(state)).toBe(true)

    const summary = handAndFootEngine.summary(state, [
      player('a', 'Alice'),
      player('b', 'Bob'),
      player('c', 'Cara'),
      player('d', 'Dee'),
    ])
    expect(summary.winnerIds.sort()).toEqual(['a', 'b'])
    expect(summary.entries[0]?.score).toBe(5100)
  })

  it('supports cutthroat (one player per team)', () => {
    let state = cutthroatTwo(1000)
    expect(state.teams).toHaveLength(2)
    const teamA = teamIdForPlayer(state, 'a')!
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', teamId: teamA, roundIndex: 0, score: 1000 },
      ctxHost,
    )
    const teamB = teamIdForPlayer(state, 'b')!
    state = handAndFootEngine.applyAction(
      state,
      { type: 'setScore', teamId: teamB, roundIndex: 0, score: 400 },
      ctxHost,
    )
    expect(handAndFootEngine.isFinished(state)).toBe(true)
  })

  it('moves players between teams and drops empty teams', () => {
    let state = fourPlayerPartnership()
    const [teamA, teamB] = state.teams
    state = handAndFootEngine.applyAction(
      state,
      { type: 'movePlayer', playerId: 'b', teamId: teamB!.id },
      ctxHost,
    )
    expect(state.teams.find((t) => t.id === teamA!.id)?.playerIds).toEqual(['a'])
    expect(state.teams.find((t) => t.id === teamB!.id)?.playerIds).toEqual(['c', 'd', 'b'])

    state = handAndFootEngine.applyAction(
      state,
      { type: 'movePlayer', playerId: 'a', teamId: teamB!.id },
      ctxHost,
    )
    expect(state.teams).toHaveLength(1)
    expect(state.teams[0]?.playerIds.sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('adds late joiners as their own team and removes players cleanly', () => {
    let state = fourPlayerPartnership()
    state = handAndFootEngine.addPlayer!(state, player('e', 'Eve'))
    expect(state.teams).toHaveLength(3)
    expect(teamIdForPlayer(state, 'e')).toBeTruthy()
    state = handAndFootEngine.removePlayer!(state, 'e')
    expect(state.teams).toHaveLength(2)
    expect(state.playerIds).not.toContain('e')
  })
})
