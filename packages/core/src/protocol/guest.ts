import type { RoomTransport } from '../transport/types'
import { Emitter, type Unsubscribe } from '../util/emitter'
import { randomId } from '../util/ids'
import {
  makeEnvelope,
  parseEnvelope,
  type PlayerProfile,
  type SessionState,
  type WireMessage,
} from './session-state'

export type GuestStatus =
  | 'connecting' // transport is coming up
  | 'waiting_host' // in the room, no host state seen yet
  | 'joined' // receiving state from the host
  | 'host_lost' // host went quiet; still listening for it to come back
  | 'removed' // host removed us from the session
  | 'rejected' // host refused our hello
  | 'ended' // host ended the session (or we left)

const HELLO_RETRY_MS = 4_000
const HEARTBEAT_MS = 15_000
const HOST_TIMEOUT_MS = 35_000
const WATCHDOG_MS = 5_000

export interface GuestSessionOptions {
  code: string
  profile: PlayerProfile
  transport: RoomTransport
  now?: () => number
}

/**
 * The guest side of a session: says hello until the host answers, mirrors
 * every state broadcast, sends actions, and watches for the host going quiet.
 */
export class GuestSession {
  readonly onState = new Emitter<SessionState>()
  readonly onStatus = new Emitter<GuestStatus>()
  readonly onReject = new Emitter<{ reqId?: string; reason: string }>()

  private readonly code: string
  private readonly profile: PlayerProfile
  private readonly transport: RoomTransport
  private readonly now: () => number

  private _state: SessionState | null = null
  private _status: GuestStatus = 'connecting'
  private lastHostSeen = 0
  private timers: ReturnType<typeof setInterval>[] = []
  private unsubscribes: Unsubscribe[] = []
  private stopped = false

  constructor(options: GuestSessionOptions) {
    this.code = options.code.toUpperCase()
    this.profile = options.profile
    this.transport = options.transport
    this.now = options.now ?? (() => Date.now())

    this.unsubscribes.push(
      this.transport.onMessage.subscribe((p) => this.handlePayload(p)),
      this.transport.onStatus.subscribe((status) => {
        if (status === 'connected' && this._status === 'connecting') {
          this.setStatus('waiting_host')
          this.sendHello()
        }
      }),
    )
  }

  get state(): SessionState | null {
    return this._state
  }

  get status(): GuestStatus {
    return this._status
  }

  get playerId(): string {
    return this.profile.id
  }

  /** The guest's own player entry in the latest state, if joined. */
  get me() {
    return this._state?.players.find((p) => p.id === this.profile.id) ?? null
  }

  start(): void {
    this.transport.start()
    if (this.transport.status === 'connected') {
      this.setStatus('waiting_host')
      this.sendHello()
    }
    this.timers.push(
      setInterval(() => {
        // Keep announcing until the host has us; re-announce while host_lost
        // so a resumed host picks us right back up.
        if (this._status === 'waiting_host' || this._status === 'host_lost') this.sendHello()
      }, HELLO_RETRY_MS),
      setInterval(() => {
        if (this._status === 'joined') {
          this.sendWire({ t: 'hb', playerId: this.profile.id, rev: this._state?.rev ?? 0 })
        }
      }, HEARTBEAT_MS),
      setInterval(() => this.watchdog(), WATCHDOG_MS),
    )
  }

  leave(): void {
    if (this.stopped) return
    this.sendWire({ t: 'bye', playerId: this.profile.id })
    this.setStatus('ended')
    this.stop()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    for (const t of this.timers) clearInterval(t)
    for (const u of this.unsubscribes) u()
    this.transport.stop()
  }

  sendAction(action: { type: string } & Record<string, unknown>): string {
    const reqId = randomId(4)
    this.sendWire({ t: 'action', playerId: this.profile.id, reqId, action })
    return reqId
  }

  requestSync(): void {
    this.sendWire({ t: 'sync', playerId: this.profile.id })
  }

  private watchdog(): void {
    if (this._status !== 'joined') return
    if (this.now() - this.lastHostSeen > HOST_TIMEOUT_MS) {
      this.setStatus('host_lost')
    }
  }

  private handlePayload(payload: unknown): void {
    const env = parseEnvelope(payload, this.code)
    if (!env) return
    const msg = env.msg
    switch (msg.t) {
      case 'state': {
        this.lastHostSeen = this.now()
        const incoming = msg.state
        if (this._state && incoming.rev < this._state.rev) return // stale
        this._state = incoming
        const inSession = incoming.players.some((p) => p.id === this.profile.id)
        if (!inSession) {
          // We were in and now we're not -> the host removed us.
          if (this._status === 'joined') this.setStatus('removed')
          return
        }
        if (this._status !== 'joined') this.setStatus('joined')
        // A resumed host marks remote players disconnected until they check
        // in again — answer immediately instead of waiting for the next
        // heartbeat interval.
        const meNow = incoming.players.find((p) => p.id === this.profile.id)
        if (meNow && !meNow.connected) this.sendHello()
        this.onState.emit(incoming)
        break
      }
      case 'ping':
        this.lastHostSeen = this.now()
        if (this._status === 'host_lost') this.setStatus('joined')
        if (this._state && msg.rev > this._state.rev) this.requestSync()
        break
      case 'reject':
        if (msg.to === this.profile.id) {
          this.onReject.emit({ reqId: msg.reqId, reason: msg.reason })
          if (this._status === 'waiting_host') this.setStatus('rejected')
        }
        break
      case 'ended':
        this.setStatus('ended')
        break
      default:
        break // guests ignore guest-originated message types
    }
  }

  private sendHello(): void {
    this.sendWire({ t: 'hello', player: this.profile })
  }

  private sendWire(msg: WireMessage): void {
    this.transport.send(makeEnvelope(this.code, this.profile.id, msg))
  }

  private setStatus(status: GuestStatus): void {
    if (this._status === status) return
    this._status = status
    this.onStatus.emit(status)
  }
}

export function createGuestSession(options: GuestSessionOptions): GuestSession {
  return new GuestSession(options)
}
