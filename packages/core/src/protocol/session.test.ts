import { describe, expect, it, vi } from 'vitest'
import { ginRummyEngine } from '../games/gin-rummy'
import { wingspanEngine, type WingspanState } from '../games/wingspan'
import { createMemoryTransport } from '../transport/memory'
import { generateJoinCode } from '../util/ids'
import { createGuestSession, type GuestSession } from './guest'
import { createHostSession, type HostSession } from './host'
import type { PlayerProfile, SessionState } from './session-state'

function profile(id: string, name: string): PlayerProfile {
  return { id, name, emoji: '🎲' }
}

async function until<T>(fn: () => T | undefined | null | false): Promise<T> {
  return vi.waitFor(
    () => {
      const value = fn()
      expect(value).toBeTruthy()
      return value as T
    },
    { timeout: 5000, interval: 10 },
  )
}

function makeHost(code: string, game = wingspanEngine as never): HostSession {
  const host = createHostSession({
    code,
    game,
    hostProfile: profile('host-1', 'Hana'),
    transport: createMemoryTransport(code),
  })
  host.start()
  return host
}

function makeGuest(code: string, id: string, name: string): GuestSession {
  const guest = createGuestSession({
    code,
    profile: profile(id, name),
    transport: createMemoryTransport(code),
  })
  guest.start()
  return guest
}

describe('host/guest session over memory transport', () => {
  it('runs a full wingspan session: join, start, score, finish', async () => {
    const code = generateJoinCode()
    const host = makeHost(code)
    const g1 = makeGuest(code, 'guest-1', 'Gale')
    const g2 = makeGuest(code, 'guest-2', 'Wren')

    await until(() => host.current.players.length === 3 || null)
    await until(() => (g1.status === 'joined' ? true : null))
    await until(() => (g2.status === 'joined' ? true : null))
    expect(g1.state?.phase).toBe('lobby')

    expect(host.startGame()).toBeNull()
    await until(() => (g1.state?.phase === 'playing' ? true : null))

    // Guests fill their own sheets; host edits its own too.
    g1.sendAction({ type: 'setCategory', playerId: 'guest-1', category: 'birds', value: 41 })
    g1.sendAction({ type: 'setCategory', playerId: 'guest-1', category: 'eggs', value: 12 })
    g2.sendAction({ type: 'setCategory', playerId: 'guest-2', category: 'birds', value: 39 })
    expect(host.applyAction({ type: 'setCategory', playerId: 'host-1', category: 'birds', value: 55 })).toBeNull()

    await until(() => {
      const game = host.current.game as WingspanState | null
      return game?.sheets['guest-1']?.birds === 41 &&
        game.sheets['guest-1']?.eggs === 12 &&
        game.sheets['guest-2']?.birds === 39
        ? true
        : null
    })

    // Everyone sees everyone's numbers.
    await until(() => {
      const game = g2.state?.game as WingspanState | null
      return game?.sheets['host-1']?.birds === 55 && game.sheets['guest-1']?.birds === 41 ? true : null
    })

    expect(host.finish()).toBeNull()
    const finished = await until(() => (g1.state?.phase === 'finished' ? g1.state : null))
    expect(finished.summary?.winnerIds).toEqual(['host-1'])
    expect(finished.summary?.headline).toContain('Hana')

    host.end()
    await until(() => (g1.status === 'ended' ? true : null))
    g1.stop()
    g2.stop()
  })

  it('rejects a guest action that fails validation', async () => {
    const code = generateJoinCode()
    const host = makeHost(code)
    const g1 = makeGuest(code, 'guest-1', 'Gale')
    await until(() => (g1.status === 'joined' ? true : null))
    host.startGame()
    await until(() => (g1.state?.phase === 'playing' ? true : null))

    const rejections: string[] = []
    g1.onReject.subscribe((r) => rejections.push(r.reason))
    g1.sendAction({ type: 'setCategory', playerId: 'host-1', category: 'birds', value: 999 })
    await until(() => (rejections.length > 0 ? true : null))
    expect(rejections[0]).toMatch(/own sheet/)

    host.end()
    g1.stop()
  })

  it('enforces max players and blocks late joins for gin rummy', async () => {
    const code = generateJoinCode()
    const host = makeHost(code, ginRummyEngine as never)
    const g1 = makeGuest(code, 'guest-1', 'Gale')
    await until(() => (g1.status === 'joined' ? true : null))
    expect(host.startGame()).toBeNull()

    const late = makeGuest(code, 'guest-2', 'Late Larry')
    await until(() => (late.status === 'rejected' ? true : null))

    host.end()
    g1.stop()
    late.stop()
  })

  it('lets the host add local players and kick guests', async () => {
    const code = generateJoinCode()
    const host = makeHost(code)
    expect(host.addLocalPlayer({ name: 'Grandma', emoji: '👵' })).toBeNull()
    const g1 = makeGuest(code, 'guest-1', 'Gale')
    await until(() => (g1.status === 'joined' ? true : null))
    expect(host.current.players).toHaveLength(3)

    expect(host.removePlayer('guest-1')).toBeNull()
    await until(() => (g1.status === 'removed' ? true : null))

    host.end()
    g1.stop()
  })

  it('finishes gin automatically at the target and supports rematch', async () => {
    const code = generateJoinCode()
    const host = makeHost(code, ginRummyEngine as never)
    const g1 = makeGuest(code, 'guest-1', 'Bob')
    await until(() => (g1.status === 'joined' ? true : null))
    host.startGame()
    await until(() => (g1.state?.phase === 'playing' ? true : null))

    // A guest can record a hand; host is the authority.
    g1.sendAction({
      type: 'recordHand',
      knockerId: 'guest-1',
      outcome: 'gin',
      knockerDeadwood: 0,
      defenderDeadwood: 80,
    })
    const finished = await until(() => (g1.state?.phase === 'finished' ? g1.state : null))
    expect(finished.summary?.winnerIds).toEqual(['guest-1'])
    const firstSessionId = finished.sessionId

    expect(host.rematch()).toBeNull()
    const rematched = await until(() =>
      g1.state?.phase === 'playing' && g1.state.sessionId !== firstSessionId ? g1.state : null,
    )
    expect(rematched.summary).toBeUndefined()

    host.end()
    g1.stop()
  })

  it('resumes a session from a snapshot and reclaims guest seats', async () => {
    const code = generateJoinCode()
    let snapshot: SessionState | undefined
    const host = createHostSession({
      code,
      game: wingspanEngine as never,
      hostProfile: profile('host-1', 'Hana'),
      transport: createMemoryTransport(code),
      onSnapshot: (s) => {
        snapshot = s
      },
    })
    host.start()
    const g1 = makeGuest(code, 'guest-1', 'Gale')
    await until(() => (g1.status === 'joined' ? true : null))
    host.startGame()
    g1.sendAction({ type: 'setCategory', playerId: 'guest-1', category: 'birds', value: 21 })
    await until(() => ((host.current.game as WingspanState | null)?.sheets['guest-1']?.birds === 21 ? true : null))

    // Host device "crashes" (no polite end) and comes back from the snapshot.
    host.stop()
    const resumed = createHostSession({
      code,
      game: wingspanEngine as never,
      hostProfile: profile('host-1', 'Hana'),
      transport: createMemoryTransport(code),
      resumeFrom: snapshot!,
    })
    resumed.start()

    await until(() => {
      const game = resumed.current.game as WingspanState | null
      const guest = resumed.current.players.find((p) => p.id === 'guest-1')
      return game?.sheets['guest-1']?.birds === 21 && guest?.connected ? true : null
    })

    resumed.end()
    g1.stop()
  })
})
