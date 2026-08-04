import { deriveRoomKey, open, roomAad, roomTopic, seal } from '../protocol/crypto'
import {
  JAMEZ_EVENT_KIND,
  generateKeypair,
  signEvent,
  type NostrEvent,
  type NostrKeypair,
} from '../protocol/nostr-event'
import { Emitter } from '../util/emitter'
import type { RoomTransport, TransportStatus } from './types'

/**
 * Default relay set. These are long-lived public Nostr relays; Jamez only
 * sends *ephemeral* events (kind 20808) through them, which relays broadcast
 * to current subscribers and never store. Payloads are end-to-end encrypted
 * with a key derived from the join code, so relays only see ciphertext.
 *
 * Users can override this list (Settings on web/mobile), e.g. to point at a
 * self-hosted `@jamez/relay` instance on the local network for fully offline
 * game nights.
 */
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://offchain.pub',
]

const SUBSCRIPTION_ID = 'jamez'
const MAX_QUEUED_SENDS = 100
const MAX_SEEN_IDS = 2000
const MAX_RECONNECT_DELAY_MS = 30_000

/** Minimal WebSocket surface we need; lets tests inject the `ws` package. */
export interface WebSocketLike {
  readyState: number
  send(data: string): void
  close(): void
  onopen: ((ev?: unknown) => void) | null
  onclose: ((ev?: unknown) => void) | null
  onerror: ((ev?: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
}

export type WebSocketFactory = (url: string) => WebSocketLike

export interface NostrTransportOptions {
  code: string
  relays?: string[]
  webSocketFactory?: WebSocketFactory
  onLog?: (message: string) => void
}

interface RelayConnection {
  url: string
  socket: WebSocketLike | null
  open: boolean
  /** True once the relay has acknowledged our REQ with EOSE. */
  subscribed: boolean
  attempts: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
}

function defaultWebSocketFactory(url: string): WebSocketLike {
  const WS = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket
  if (!WS) {
    throw new Error('No global WebSocket available; pass webSocketFactory explicitly.')
  }
  return new WS(url)
}

export class NostrRoomTransport implements RoomTransport {
  readonly onMessage = new Emitter<unknown>()
  readonly onStatus = new Emitter<TransportStatus>()

  private readonly key: Uint8Array
  private readonly aad: Uint8Array
  private readonly topic: string
  private readonly keypair: NostrKeypair
  private readonly relays: string[]
  private readonly wsFactory: WebSocketFactory
  private readonly log: (message: string) => void

  private connections: RelayConnection[] = []
  private queue: string[] = []
  private seenIds = new Set<string>()
  private _status: TransportStatus = 'connecting'
  private stopped = true

  constructor(options: NostrTransportOptions) {
    this.key = deriveRoomKey(options.code)
    this.aad = roomAad(options.code)
    this.topic = roomTopic(options.code)
    this.keypair = generateKeypair()
    this.relays = (options.relays?.length ? options.relays : DEFAULT_RELAYS).map((u) => u.trim())
    this.wsFactory = options.webSocketFactory ?? defaultWebSocketFactory
    this.log = options.onLog ?? (() => {})
  }

  get selfId(): string {
    return this.keypair.publicKeyHex
  }

  get status(): TransportStatus {
    return this._status
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.setStatus('connecting')
    this.connections = this.relays.map((url) => ({
      url,
      socket: null,
      open: false,
      subscribed: false,
      attempts: 0,
      reconnectTimer: null,
    }))
    for (const conn of this.connections) this.connect(conn)
  }

  stop(): void {
    this.stopped = true
    for (const conn of this.connections) {
      if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer)
      conn.reconnectTimer = null
      const socket = conn.socket
      conn.socket = null
      conn.open = false
      conn.subscribed = false
      if (socket) {
        socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null
        try {
          socket.close()
        } catch {
          // ignore
        }
      }
    }
    this.connections = []
    this.queue = []
    this.setStatus('offline')
  }

  send(payload: unknown): void {
    const event = signEvent(this.keypair, {
      kind: JAMEZ_EVENT_KIND,
      tags: [['t', this.topic]],
      content: seal(this.key, payload, this.aad),
    })
    const frame = JSON.stringify(['EVENT', event])
    let sent = false
    for (const conn of this.connections) {
      if (conn.open && conn.socket) {
        try {
          conn.socket.send(frame)
          sent = true
        } catch {
          // connection is on its way down; reconnect logic will handle it
        }
      }
    }
    if (!sent) {
      this.queue.push(frame)
      if (this.queue.length > MAX_QUEUED_SENDS) this.queue.shift()
    }
  }

  private connect(conn: RelayConnection): void {
    if (this.stopped) return
    let socket: WebSocketLike
    try {
      socket = this.wsFactory(conn.url)
    } catch (err) {
      this.log(`failed to create socket for ${conn.url}: ${String(err)}`)
      this.scheduleReconnect(conn)
      return
    }
    conn.socket = socket

    socket.onopen = () => {
      conn.open = true
      conn.subscribed = false
      conn.attempts = 0
      const since = Math.floor(Date.now() / 1000) - 30
      socket.send(
        JSON.stringify([
          'REQ',
          SUBSCRIPTION_ID,
          { kinds: [JAMEZ_EVENT_KIND], '#t': [this.topic], since },
        ]),
      )
      // Flush outbound traffic as soon as the socket is writable. "connected"
      // status waits for EOSE so peers don't send *before* the relay has
      // registered our subscription (ephemeral events are otherwise lost).
      this.flushQueue()
      this.recomputeStatus()
    }

    socket.onmessage = (ev) => {
      this.handleFrame(
        typeof ev.data === 'string' ? ev.data : String(ev.data),
        conn,
      )
    }

    socket.onerror = () => {
      // onclose always follows; reconnect is handled there.
    }

    socket.onclose = () => {
      conn.open = false
      conn.subscribed = false
      conn.socket = null
      this.recomputeStatus()
      this.scheduleReconnect(conn)
    }
  }

  private scheduleReconnect(conn: RelayConnection): void {
    if (this.stopped || conn.reconnectTimer) return
    conn.attempts += 1
    const base = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** Math.min(conn.attempts, 5))
    const delay = base / 2 + Math.random() * (base / 2)
    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = null
      this.connect(conn)
    }, delay)
  }

  private flushQueue(): void {
    if (this.queue.length === 0) return
    const pending = this.queue
    this.queue = []
    for (const frame of pending) {
      let sent = false
      for (const conn of this.connections) {
        if (conn.open && conn.socket) {
          try {
            conn.socket.send(frame)
            sent = true
          } catch {
            // ignore; other relays may succeed
          }
        }
      }
      if (!sent) this.queue.push(frame)
    }
  }

  private handleFrame(raw: string, conn: RelayConnection): void {
    let frame: unknown
    try {
      frame = JSON.parse(raw)
    } catch {
      return
    }
    if (!Array.isArray(frame)) return
    const [type] = frame
    if (type === 'EVENT' && frame.length >= 3) {
      this.handleEvent(frame[2] as NostrEvent)
    } else if (type === 'EOSE' && frame[1] === SUBSCRIPTION_ID) {
      // Relay has registered our REQ; safe to treat this connection as live
      // for receive (and for tests that wait on status === 'connected').
      if (!conn.subscribed) {
        conn.subscribed = true
        this.recomputeStatus()
      }
    } else if (type === 'OK' && frame[2] === false) {
      this.log(`relay rejected event: ${String(frame[3] ?? '')}`)
    } else if (type === 'NOTICE') {
      this.log(`relay notice: ${String(frame[1] ?? '')}`)
    }
    // CLOSED is handled via socket onclose / reconnect.
  }

  private handleEvent(event: NostrEvent): void {
    if (!event || typeof event !== 'object') return
    if (event.kind !== JAMEZ_EVENT_KIND) return
    if (event.pubkey === this.keypair.publicKeyHex) return // self-echo
    if (typeof event.id !== 'string' || this.seenIds.has(event.id)) return
    this.seenIds.add(event.id)
    if (this.seenIds.size > MAX_SEEN_IDS) {
      // Drop the oldest half; Set iteration order is insertion order.
      const ids = [...this.seenIds]
      this.seenIds = new Set(ids.slice(ids.length / 2))
    }
    const payload = open(this.key, event.content, this.aad)
    if (payload === null) return // not for this room / tampered / wrong key
    this.onMessage.emit(payload)
  }

  private recomputeStatus(): void {
    // Require a live subscription (EOSE), not just an open socket. Public and
    // local relays both ack REQ with EOSE; until then ephemeral EVENT frames
    // published by peers can race past an unregistered filter and be dropped.
    const anyReady = this.connections.some((c) => c.open && c.subscribed)
    this.setStatus(anyReady ? 'connected' : this.stopped ? 'offline' : 'connecting')
  }

  private setStatus(status: TransportStatus): void {
    if (this._status === status) return
    this._status = status
    this.onStatus.emit(status)
  }
}

export function createNostrTransport(options: NostrTransportOptions): RoomTransport {
  return new NostrRoomTransport(options)
}
