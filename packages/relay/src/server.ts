import { schnorr } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { WebSocketServer, type WebSocket } from 'ws'

/**
 * A deliberately tiny Nostr relay (NIP-01 subset) that keeps everything in
 * memory and stores nothing. It exists for three reasons:
 *
 * 1. Fully offline / LAN-only game nights: run `pnpm relay` on any machine on
 *    the network and point the apps at it from Settings.
 * 2. Local development without touching public relays.
 * 3. Integration tests for the transport layer.
 *
 * Events are validated (id + schnorr signature) and fanned out to matching
 * subscriptions, then dropped. Nothing is ever written to disk.
 */

interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

type Filter = Record<string, unknown>

interface Subscription {
  id: string
  filters: Filter[]
}

export interface RelayOptions {
  port?: number
  host?: string
  verbose?: boolean
}

export interface RelayHandle {
  port: number
  url: string
  clientCount: () => number
  close: () => Promise<void>
}

function verifyEvent(event: NostrEvent): boolean {
  try {
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ])
    const expectedId = bytesToHex(sha256(utf8ToBytes(serialized)))
    if (expectedId !== event.id) return false
    return schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey))
  } catch {
    return false
  }
}

function matchesFilter(event: NostrEvent, filter: Filter): boolean {
  const ids = filter['ids'] as string[] | undefined
  if (ids && !ids.includes(event.id)) return false
  const authors = filter['authors'] as string[] | undefined
  if (authors && !authors.includes(event.pubkey)) return false
  const kinds = filter['kinds'] as number[] | undefined
  if (kinds && !kinds.includes(event.kind)) return false
  const since = filter['since'] as number | undefined
  if (since !== undefined && event.created_at < since) return false
  const until = filter['until'] as number | undefined
  if (until !== undefined && event.created_at > until) return false
  for (const [key, value] of Object.entries(filter)) {
    if (!key.startsWith('#') || key.length !== 2) continue
    const wanted = value as string[]
    const tagName = key.slice(1)
    const tagValues = event.tags.filter((t) => t[0] === tagName).map((t) => t[1])
    if (!wanted.some((w) => tagValues.includes(w))) return false
  }
  return true
}

export function startRelay(options: RelayOptions = {}): Promise<RelayHandle> {
  const { port = 7447, host = '0.0.0.0', verbose = false } = options
  const log = (...args: unknown[]) => {
    if (verbose) console.log('[jamez-relay]', ...args)
  }

  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port, host })
    const subscriptions = new Map<WebSocket, Map<string, Subscription>>()

    wss.on('connection', (socket) => {
      subscriptions.set(socket, new Map())
      log('client connected', `(${wss.clients.size} total)`)

      socket.on('message', (raw) => {
        let frame: unknown
        try {
          frame = JSON.parse(raw.toString())
        } catch {
          socket.send(JSON.stringify(['NOTICE', 'invalid: not json']))
          return
        }
        if (!Array.isArray(frame)) return
        const [type] = frame

        if (type === 'EVENT') {
          const event = frame[1] as NostrEvent
          if (!event || typeof event.id !== 'string') return
          if (!verifyEvent(event)) {
            socket.send(JSON.stringify(['OK', event.id, false, 'invalid: bad id or signature']))
            return
          }
          socket.send(JSON.stringify(['OK', event.id, true, '']))
          // Fan out to every matching subscription (including the sender's own
          // subscriptions, exactly like public relays do).
          let delivered = 0
          for (const [client, subs] of subscriptions) {
            if (client.readyState !== client.OPEN) continue
            for (const sub of subs.values()) {
              if (sub.filters.some((f) => matchesFilter(event, f))) {
                client.send(JSON.stringify(['EVENT', sub.id, event]))
                delivered += 1
                break
              }
            }
          }
          log(`event kind=${event.kind} delivered to ${delivered} subscription(s)`)
          // Ephemeral by design: nothing is stored, for any kind.
          return
        }

        if (type === 'REQ') {
          const subId = String(frame[1] ?? '')
          if (!subId) return
          const filters = frame.slice(2).filter((f) => f && typeof f === 'object') as Filter[]
          subscriptions.get(socket)?.set(subId, { id: subId, filters })
          // No stored events to replay; end-of-stored-events comes immediately.
          socket.send(JSON.stringify(['EOSE', subId]))
          log(`subscription ${subId} registered`)
          return
        }

        if (type === 'CLOSE') {
          const subId = String(frame[1] ?? '')
          subscriptions.get(socket)?.delete(subId)
          return
        }
      })

      socket.on('close', () => {
        subscriptions.delete(socket)
        log('client disconnected', `(${wss.clients.size} total)`)
      })
      socket.on('error', () => {
        // close handler does the cleanup
      })
    })

    wss.on('listening', () => {
      const address = wss.address()
      const actualPort = typeof address === 'object' && address ? address.port : port
      resolve({
        port: actualPort,
        url: `ws://127.0.0.1:${actualPort}`,
        clientCount: () => wss.clients.size,
        close: () =>
          new Promise<void>((res) => {
            for (const client of wss.clients) client.terminate()
            wss.close(() => res())
          }),
      })
    })
    wss.on('error', reject)
  })
}
