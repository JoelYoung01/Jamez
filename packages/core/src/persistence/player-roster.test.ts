import { describe, expect, it } from 'vitest'
import {
  filterLibraryPlayers,
  libraryPlayerByClientId,
  mergeLibraryPlayers,
  migrateLibraryEntries,
  setLibraryInactive,
  upsertLibraryPlayer,
  type LibraryPlayer,
} from './player-roster'

function entry(partial: Partial<LibraryPlayer> & Pick<LibraryPlayer, 'id' | 'name'>): LibraryPlayer {
  return {
    emoji: '🙂',
    clientIds: [],
    lastSeenAt: 100,
    ...partial,
  }
}

describe('player library', () => {
  it('migrates remote roster rows into client ids', () => {
    const entries = migrateLibraryEntries([
      { id: 'phone', name: 'Pat', emoji: '🃏', source: 'remote', lastPlayedAt: 5 },
      { id: 'guest', name: 'Gale', emoji: '🦆', source: 'local', lastPlayedAt: 4, photo: 'data:img' },
    ])
    expect(entries[0]).toMatchObject({ id: 'phone', clientIds: ['phone'], lastSeenAt: 5 })
    expect(entries[1]).toMatchObject({ id: 'guest', clientIds: [], photo: 'data:img' })
  })

  it('keeps a phone profile unless the phone itself checks in', () => {
    let list: LibraryPlayer[] = []
    list = upsertLibraryPlayer(list, {
      id: 'p1',
      name: 'Gale',
      emoji: '🦆',
      photo: 'data:img',
      clientIds: ['p1'],
      fromClient: true,
      lastSeenAt: 1,
    })
    list = upsertLibraryPlayer(list, {
      id: 'p1',
      name: 'Host edit',
      emoji: '🔥',
      lastSeenAt: 2,
    })
    expect(list[0]).toMatchObject({ name: 'Gale', emoji: '🦆', photo: 'data:img' })
    list = upsertLibraryPlayer(list, {
      id: 'p1',
      name: 'Gale X',
      emoji: '🦆',
      clientIds: ['p1'],
      fromClient: true,
      lastSeenAt: 3,
    })
    expect(list[0]?.name).toBe('Gale X')
  })

  it('merges two phones onto the survivor and keeps both client ids', () => {
    const list = [
      entry({ id: 'web', name: 'Pat', emoji: '🃏', clientIds: ['web'], alias: 'P' }),
      entry({ id: 'app', name: 'Patrick', emoji: '🎴', clientIds: ['app'] }),
    ]
    const merged = mergeLibraryPlayers(list, 'web', 'app', { name: 'from', alias: 'from' })
    expect('error' in merged).toBe(false)
    if ('error' in merged) return
    expect(merged.entries).toHaveLength(1)
    expect(merged.entries[0]).toMatchObject({
      id: 'app',
      name: 'Pat',
      emoji: '🎴',
      alias: 'P',
      clientIds: ['app', 'web'],
    })
    expect(libraryPlayerByClientId(merged.entries, 'web')?.id).toBe('app')
  })

  it('filters inactive players and searches alias plus name', () => {
    let list = [
      entry({ id: 'a', name: 'Ann', alias: 'Annie', lastSeenAt: 1 }),
      entry({ id: 'b', name: 'Bea', lastSeenAt: 3, inactive: true }),
    ]
    expect(filterLibraryPlayers(list, '').map((e) => e.id)).toEqual(['a'])
    expect(filterLibraryPlayers(list, 'annie').map((e) => e.id)).toEqual(['a'])
    list = setLibraryInactive(list, 'b', false)
    expect(filterLibraryPlayers(list, '', { includeInactive: false }).map((e) => e.id)).toEqual(['b', 'a'])
    expect(filterLibraryPlayers(list, '', { seatedIds: ['b'] }).map((e) => e.id)).toEqual(['a'])
  })
})
