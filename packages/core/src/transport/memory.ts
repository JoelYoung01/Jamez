import { Emitter } from '../util/emitter'
import { randomId } from '../util/ids'
import type { RoomTransport, TransportStatus } from './types'

/**
 * In-process transport. Powers "Pass & Play" (a session that never leaves the
 * device) and makes the whole protocol unit-testable without any network.
 */

const rooms = new Map<string, Set<MemoryRoomTransport>>()

export class MemoryRoomTransport implements RoomTransport {
  readonly selfId = randomId(8)
  readonly onMessage = new Emitter<unknown>()
  readonly onStatus = new Emitter<TransportStatus>()

  private _status: TransportStatus = 'connecting'
  private readonly roomKey: string

  constructor(code: string) {
    this.roomKey = code.toUpperCase()
  }

  get status(): TransportStatus {
    return this._status
  }

  start(): void {
    let members = rooms.get(this.roomKey)
    if (!members) {
      members = new Set()
      rooms.set(this.roomKey, members)
    }
    members.add(this)
    this.setStatus('connected')
  }

  stop(): void {
    const members = rooms.get(this.roomKey)
    members?.delete(this)
    if (members && members.size === 0) rooms.delete(this.roomKey)
    this.setStatus('offline')
  }

  send(payload: unknown): void {
    const members = rooms.get(this.roomKey)
    if (!members) return
    // Deep-copy via JSON and deliver on a microtask: mirrors real transports
    // (no shared object identity, no re-entrant emits).
    const serialized = JSON.stringify(payload)
    for (const member of members) {
      if (member === this) continue
      queueMicrotask(() => {
        if (member._status === 'connected') {
          member.onMessage.emit(JSON.parse(serialized))
        }
      })
    }
  }

  private setStatus(status: TransportStatus): void {
    if (this._status === status) return
    this._status = status
    this.onStatus.emit(status)
  }
}

export function createMemoryTransport(code: string): RoomTransport {
  return new MemoryRoomTransport(code)
}
