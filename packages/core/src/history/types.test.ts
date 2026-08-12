import { describe, expect, it } from 'vitest'
import { ginRummyEngine, type GinState } from '../games/gin-rummy'
import { wingspanEngine } from '../games/wingspan'
import type { SessionPlayer, SessionState } from '../protocol/session-state'
import {
  ginHandsFromHistory,
  historyDetailFromState,
  historyRecordFromState,
} from './types'

function player(id: string, name: string, isHost = false): SessionPlayer {
  return {
    id,
    name,
    emoji: '🃏',
    color: '#fff',
    isHost,
    remote: !isHost,
    connected: true,
    joinedAt: 0,
  }
}

const players = [player('a', 'Alice', true), player('b', 'Bob')]

function finishedGin(): SessionState<GinState> {
  const config = ginRummyEngine.defaultConfig()
  let game = ginRummyEngine.init(config, players)
  game = ginRummyEngine.applyAction(
    game,
    {
      type: 'recordHand',
      knockerId: 'a',
      outcome: 'gin',
      knockerDeadwood: 0,
      defenderDeadwood: 30,
    },
    { actorId: 'a', isHost: true, now: 1000 },
  )
  game = ginRummyEngine.applyAction(
    game,
    {
      type: 'recordHand',
      knockerId: 'a',
      outcome: 'bigGin',
      knockerDeadwood: 0,
      defenderDeadwood: 50,
    },
    { actorId: 'a', isHost: true, now: 2000 },
  )
  return {
    v: 1,
    sessionId: 'sess-1',
    code: 'ABCDEF',
    gameId: 'gin-rummy',
    gameConfig: config,
    phase: 'finished',
    rev: 3,
    players,
    game,
    createdAt: 500,
    startedAt: 600,
    finishedAt: 3000,
    summary: ginRummyEngine.summary(game, players),
  }
}

describe('historyRecordFromState gin detail', () => {
  it('archives gin hands including dealer snapshots', () => {
    const state = finishedGin()
    const record = historyRecordFromState(state, 'a')
    expect(record).not.toBeNull()
    expect(record!.detail).toEqual({
      type: 'gin-rummy',
      hands: state.game!.hands,
    })
    expect(ginHandsFromHistory(record!)).toHaveLength(2)
    expect(ginHandsFromHistory(record!)[0]?.dealerId).toBe('a')
    expect(ginHandsFromHistory(record!)[1]?.dealerId).toBe('b')
  })

  it('clones hands so later session mutations do not rewrite history', () => {
    const state = finishedGin()
    const record = historyRecordFromState(state, 'a')!
    state.game!.hands[0]!.points = 999
    expect(record.detail?.type === 'gin-rummy' && record.detail.hands[0]?.points).not.toBe(999)
  })

  it('omits detail for wingspan (summary-only)', () => {
    const config = wingspanEngine.defaultConfig()
    const game = wingspanEngine.init(config, players)
    const state: SessionState = {
      v: 1,
      sessionId: 'sess-w',
      code: 'WINGSP',
      gameId: 'wingspan',
      gameConfig: config,
      phase: 'finished',
      rev: 1,
      players,
      game,
      createdAt: 1,
      finishedAt: 2,
      summary: wingspanEngine.summary(game, players),
    }
    expect(historyDetailFromState(state)).toBeUndefined()
    expect(historyRecordFromState(state, 'a')?.detail).toBeUndefined()
  })

  it('omits gin detail when the hand log is empty', () => {
    const state = finishedGin()
    state.game = { ...state.game!, hands: [] }
    expect(historyDetailFromState(state)).toBeUndefined()
  })
})
