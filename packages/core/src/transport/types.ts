import type { Emitter } from '../util/emitter'

export type TransportStatus = 'connecting' | 'connected' | 'offline'

/**
 * A transport delivers opaque JSON payloads between everyone in a room.
 * The session protocol never cares how bytes move, which keeps transports
 * swappable: in-memory (pass & play), Nostr relays (default, works across
 * networks), and later direct WebRTC or LAN sockets.
 */
export interface RoomTransport {
  /** Transport-level identity, used only to filter self-echoes. */
  readonly selfId: string
  readonly status: TransportStatus
  readonly onMessage: Emitter<unknown>
  readonly onStatus: Emitter<TransportStatus>
  start(): void
  stop(): void
  /** Broadcast a JSON-serializable payload to everyone else in the room. */
  send(payload: unknown): void
}
