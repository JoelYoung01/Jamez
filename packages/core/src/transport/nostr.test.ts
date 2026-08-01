import { startRelay, type RelayHandle } from '@jamez/relay'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createGuestSession } from '../protocol/guest'
import { createHostSession } from '../protocol/host'
import { wingspanEngine, type WingspanState } from '../games/wingspan'
import { generateJoinCode } from '../util/ids'
import { NostrRoomTransport } from './nostr'

let relayA: RelayHandle
let relayB: RelayHandle

beforeAll(async () => {
  relayA = await startRelay({ port: 0 })
  relayB = await startRelay({ port: 0 })
})

afterAll(async () => {
  await relayA.close()
  await relayB.close()
})

async function until<T>(fn: () => T | undefined | null | false): Promise<T> {
  return vi.waitFor(
    () => {
      const value = fn()
      expect(value).toBeTruthy()
      return value as T
    },
    { timeout: 10000, interval: 20 },
  )
}

describe('nostr transport over a real relay', () => {
  it('delivers encrypted payloads between peers and filters self-echo', async () => {
    const code = generateJoinCode()
    const alice = new NostrRoomTransport({ code, relays: [relayA.url] })
    const bob = new NostrRoomTransport({ code, relays: [relayA.url] })

    const aliceInbox: unknown[] = []
    const bobInbox: unknown[] = []
    alice.onMessage.subscribe((m) => aliceInbox.push(m))
    bob.onMessage.subscribe((m) => bobInbox.push(m))

    alice.start()
    bob.start()
    await until(() => (alice.status === 'connected' && bob.status === 'connected' ? true : null))

    alice.send({ from: 'alice', n: 1 })
    bob.send({ from: 'bob', n: 2 })

    await until(() => (aliceInbox.length >= 1 && bobInbox.length >= 1 ? true : null))
    expect(bobInbox).toContainEqual({ from: 'alice', n: 1 })
    expect(aliceInbox).toContainEqual({ from: 'bob', n: 2 })
    // No self-echo even though the relay sends our events back to us.
    expect(aliceInbox).not.toContainEqual({ from: 'alice', n: 1 })

    alice.stop()
    bob.stop()
  })

  it('does not leak messages across rooms', async () => {
    const alice = new NostrRoomTransport({ code: 'AAAAAA', relays: [relayA.url] })
    const eve = new NostrRoomTransport({ code: 'BBBBBB', relays: [relayA.url] })
    const eveInbox: unknown[] = []
    eve.onMessage.subscribe((m) => eveInbox.push(m))
    alice.start()
    eve.start()
    await until(() => (alice.status === 'connected' && eve.status === 'connected' ? true : null))

    alice.send({ secret: true })
    await new Promise((r) => setTimeout(r, 300))
    expect(eveInbox).toHaveLength(0)

    alice.stop()
    eve.stop()
  })

  it('dedupes when peers share multiple relays', async () => {
    const code = generateJoinCode()
    const relays = [relayA.url, relayB.url]
    const alice = new NostrRoomTransport({ code, relays })
    const bob = new NostrRoomTransport({ code, relays })
    const bobInbox: unknown[] = []
    bob.onMessage.subscribe((m) => bobInbox.push(m))
    alice.start()
    bob.start()
    await until(() => (alice.status === 'connected' && bob.status === 'connected' ? true : null))
    // Give both subscriptions a beat to land on both relays.
    await new Promise((r) => setTimeout(r, 200))

    alice.send({ n: 'once' })
    await until(() => (bobInbox.length >= 1 ? true : null))
    await new Promise((r) => setTimeout(r, 300))
    expect(bobInbox).toEqual([{ n: 'once' }])

    alice.stop()
    bob.stop()
  })

  it('queues sends made before the connection opens', async () => {
    const code = generateJoinCode()
    const listener = new NostrRoomTransport({ code, relays: [relayA.url] })
    const inbox: unknown[] = []
    listener.onMessage.subscribe((m) => inbox.push(m))
    listener.start()
    await until(() => (listener.status === 'connected' ? true : null))

    const eager = new NostrRoomTransport({ code, relays: [relayA.url] })
    eager.start()
    eager.send({ eager: true }) // socket not open yet -> queued

    await until(() => (inbox.length >= 1 ? true : null))
    expect(inbox).toContainEqual({ eager: true })

    listener.stop()
    eager.stop()
  })

  it('runs a real host/guest session end to end over the relay', async () => {
    const code = generateJoinCode()
    const host = createHostSession({
      code,
      game: wingspanEngine as never,
      hostProfile: { id: 'host-9', name: 'Hana', emoji: '🦉' },
      transport: new NostrRoomTransport({ code, relays: [relayA.url] }),
    })
    host.start()

    const guest = createGuestSession({
      code,
      profile: { id: 'guest-9', name: 'Gale', emoji: '🦆' },
      transport: new NostrRoomTransport({ code, relays: [relayA.url] }),
    })
    guest.start()

    await until(() => (guest.status === 'joined' ? true : null))
    expect(host.startGame()).toBeNull()
    await until(() => (guest.state?.phase === 'playing' ? true : null))

    guest.sendAction({ type: 'setCategory', playerId: 'guest-9', category: 'tuckedCards', value: 8 })
    await until(() =>
      (host.current.game as WingspanState | null)?.sheets['guest-9']?.tuckedCards === 8 ? true : null,
    )

    host.finish()
    await until(() => (guest.state?.phase === 'finished' ? true : null))

    host.end()
    guest.stop()
  })
})
