import { describe, expect, it } from 'vitest'
import type { SessionState } from '../protocol/session-state'
import { buildActivityFeed, sessionDisplayName } from './activity'
import { listLongTermSessions } from './long-term'
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
  it('lists open vault sessions and history, newest first', () => {
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
        status: 'inactive' as const,
      },
      {
        state: session({
          sessionId: 's1',
          code: 'AAAAAA',
          gameId: 'gin-rummy',
          phase: 'finished',
        }),
        savedAt: 150,
        status: 'complete' as const,
      },
    ]

    const feed = buildActivityFeed({ history, vault })
    expect(feed.map((i) => i.kind)).toEqual(['parked', 'history'])
    expect(feed[0]).toMatchObject({
      kind: 'parked',
      code: 'BBBBBB',
      nickname: 'Cabin trip',
      status: 'inactive',
      statusLabel: 'Parked',
    })
    expect(feed[1]).toMatchObject({ kind: 'history', canOpen: true })
  })

  it('includes parked gin matches alongside banks', () => {
    const vault = [
      {
        state: session({
          sessionId: 'gin-park',
          code: 'GINGIN',
          gameId: 'gin-rummy',
          phase: 'playing',
        }),
        savedAt: 50,
        status: 'inactive' as const,
      },
      {
        state: session({
          sessionId: 'lobby-park',
          code: 'LOBBY1',
          gameId: 'wingspan',
          phase: 'lobby',
        }),
        savedAt: 40,
        status: 'draft' as const,
      },
    ]
    const feed = buildActivityFeed({ history: [], vault })
    expect(feed).toHaveLength(2)
    expect(feed[0]).toMatchObject({ code: 'GINGIN', status: 'inactive', statusLabel: 'Parked' })
    expect(feed[1]).toMatchObject({ code: 'LOBBY1', status: 'draft', statusLabel: 'Draft' })
  })

  it('can hide ended long-term history rows', () => {
    const history: HistoryRecord[] = [
      {
        id: 'bank-1',
        gameId: 'poker-bank',
        code: 'CCCCCC',
        createdAt: 1,
        finishedAt: 300,
        players: [{ id: 'h', name: 'Host', emoji: '🎲' }],
        summary: { headline: 'Host leads', winnerIds: ['h'], entries: [] },
        myPlayerId: 'h',
        nickname: 'Friday bank',
      },
      {
        id: 'gin-1',
        gameId: 'gin-rummy',
        code: 'DDDDDD',
        createdAt: 1,
        finishedAt: 250,
        players: [{ id: 'h', name: 'Host', emoji: '🎲' }],
        summary: { headline: 'Host wins', winnerIds: ['h'], entries: [] },
        myPlayerId: 'h',
      },
    ]
    const hidden = buildActivityFeed({ history, vault: [], includeEndedLongTerm: false })
    expect(hidden.map((i) => (i.kind === 'history' ? i.record.id : i.key))).toEqual(['gin-1'])
    const shown = buildActivityFeed({ history, vault: [], includeEndedLongTerm: true })
    expect(shown.map((i) => (i.kind === 'history' ? i.record.id : i.key))).toEqual([
      'bank-1',
      'gin-1',
    ])
  })
})

describe('listLongTermSessions', () => {
  it('lists open rooms for every game type', () => {
    const vault = [
      {
        state: session({
          sessionId: 'gin-park',
          code: 'GINGIN',
          gameId: 'gin-rummy',
          phase: 'playing',
        }),
        savedAt: 120,
        status: 'inactive' as const,
      },
      {
        state: session({
          sessionId: 'bank-park',
          code: 'PARKED',
          gameId: 'poker-bank',
          phase: 'playing',
        }),
        savedAt: 100,
        status: 'inactive' as const,
      },
    ]
    const open = listLongTermSessions(vault, null)
    expect(open.map((r) => r.code)).toEqual(['GINGIN', 'PARKED'])
    expect(open[0]).toMatchObject({ status: 'inactive', live: false })
  })

  it('marks the in-memory session active for any game', () => {
    const vault = [
      {
        state: session({
          sessionId: 'gin-live',
          code: 'LIVE01',
          gameId: 'gin-rummy',
          phase: 'playing',
        }),
        savedAt: 100,
        status: 'active' as const,
      },
    ]
    const rooms = listLongTermSessions(vault, {
      code: 'LIVE01',
      gameId: 'gin-rummy',
    })
    expect(rooms).toHaveLength(1)
    expect(rooms[0]).toMatchObject({ status: 'active', live: true, code: 'LIVE01' })
  })

  it('includes ended banks only when requested', () => {
    const vault = [
      {
        state: session({
          sessionId: 'live-park',
          code: 'PARKED',
          gameId: 'poker-bank',
          phase: 'playing',
        }),
        savedAt: 100,
        status: 'inactive' as const,
      },
    ]
    const history: HistoryRecord[] = [
      {
        id: 'ended-1',
        gameId: 'poker-bank',
        code: 'ENDED1',
        createdAt: 1,
        finishedAt: 200,
        players: [],
        summary: { headline: 'Closed', winnerIds: [], entries: [] },
        myPlayerId: 'h',
      },
    ]
    const openOnly = listLongTermSessions(vault, null)
    expect(openOnly.map((r) => r.code)).toEqual(['PARKED'])
    const withEnded = listLongTermSessions(vault, null, { includeEnded: true, history })
    expect(withEnded.map((r) => r.code)).toEqual(['ENDED1', 'PARKED'])
    expect(withEnded[0]).toMatchObject({ ended: true, status: 'complete', historyId: 'ended-1' })
  })
})
