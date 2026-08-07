import { describe, expect, it } from 'vitest'
import type { SessionState } from '../protocol/session-state'
import { buildActivityFeed, sessionDisplayName } from './activity'
import type { HistoryRecord } from './types'

function session(partial: Partial<SessionState> & Pick<SessionState, 'sessionId' | 'code' | 'gameId'>): SessionState {
  return {
    v: 1,
    gameConfig: {},
    phase: 'playing',
    rev: 1,
    players: [],
    game: null,
    createdAt: 1,
    ...partial,
  }
}

describe('sessionDisplayName', () => {
  it('prefers nickname over game name', () => {
    expect(sessionDisplayName({ nickname: ' Friday bank ', gameId: 'poker-bank' })).toBe(
      'Friday bank',
    )
    expect(sessionDisplayName({ gameId: 'poker-bank' })).toBe('Poker Bank')
  })
})

describe('buildActivityFeed', () => {
  it('lists parked sessions and history, newest first', () => {
    const history: HistoryRecord[] = [
      {
        id: 's1',
        gameId: 'gin-rummy',
        code: 'AAAAAA',
        createdAt: 1,
        finishedAt: 100,
        players: [{ id: 'h', name: 'Host', emoji: '🎲' }],
        summary: { headline: 'Host wins', winnerIds: ['h'], entries: [] },
        myPlayerId: 'h',
      },
    ]
    const vault = [
      {
        state: session({
          sessionId: 's2',
          code: 'BBBBBB',
          gameId: 'poker-bank',
          nickname: 'Cabin trip',
          phase: 'playing',
        }),
        savedAt: 200,
      },
      {
        state: session({
          sessionId: 's1',
          code: 'AAAAAA',
          gameId: 'gin-rummy',
          phase: 'finished',
        }),
        savedAt: 150,
      },
    ]

    const feed = buildActivityFeed({ history, vault })
    expect(feed.map((i) => i.kind)).toEqual(['parked', 'history'])
    expect(feed[0]).toMatchObject({ kind: 'parked', code: 'BBBBBB', nickname: 'Cabin trip' })
    expect(feed[1]).toMatchObject({ kind: 'history', canOpen: true })
  })
})
