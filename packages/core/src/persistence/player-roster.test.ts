import { describe, expect, it } from 'vitest'
import {
  removeRosterPlayer,
  rosterAvailableForSession,
  sortRosterPlayers,
  upsertRosterPlayer,
  type RosterPlayer,
} from './player-roster'

function entry(partial: Partial<RosterPlayer> & Pick<RosterPlayer, 'id' | 'name'>): RosterPlayer {
  return {
    emoji: '🙂',
    source: 'local',
    lastPlayedAt: 100,
    ...partial,
  }
}

describe('player roster helpers', () => {
  it('upserts by id, preserving photo unless cleared, and prefers remote source', () => {
    let list: RosterPlayer[] = []
    list = upsertRosterPlayer(list, {
      id: 'p1',
      name: 'Gale',
      emoji: '🦆',
      source: 'local',
      photo: 'data:img',
      lastPlayedAt: 1,
    })
    list = upsertRosterPlayer(list, {
      id: 'p1',
      name: 'Gale X',
      emoji: '🦆',
      source: 'remote',
      lastPlayedAt: 2,
    })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: 'p1',
      name: 'Gale X',
      source: 'remote',
      photo: 'data:img',
      lastPlayedAt: 2,
    })

    list = upsertRosterPlayer(list, {
      id: 'p1',
      name: 'Gale',
      emoji: '🦆',
      source: 'local',
      lastPlayedAt: 3,
    })
    expect(list[0]?.source).toBe('remote')
  })

  it('sorts by recency and filters seated ids', () => {
    const list = [
      entry({ id: 'a', name: 'Ann', lastPlayedAt: 1 }),
      entry({ id: 'b', name: 'Bea', lastPlayedAt: 3 }),
      entry({ id: 'c', name: 'Cara', lastPlayedAt: 2 }),
    ]
    expect(sortRosterPlayers(list).map((e) => e.id)).toEqual(['b', 'c', 'a'])
    expect(rosterAvailableForSession(list, ['b']).map((e) => e.id)).toEqual(['c', 'a'])
    expect(removeRosterPlayer(list, 'c')).toHaveLength(2)
  })
})
