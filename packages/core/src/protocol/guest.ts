import { normalizeAvatarPhoto } from '../profile/avatar'
import type { RoomTransport } from '../transport/types'
import { Emitter, type Unsubscribe } from '../util/emitter'
import { randomId } from '../util/ids'
import {
  makeEnvelope,
  parseEnvelope,
  type PlayerProfile,
  type SessionPlayer,
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

  readonly transport: RoomTransport

  private readonly code: string
  private readonly profile: PlayerProfile
  private readonly now: () => number

  private _state: SessionState | null = null
  private _status: GuestStatus = 'connecting'
  private lastHostSeen = 0
  private timers: ReturnType<typeof setInterval>[] = []
  private unsubscribes: Unsubscribe[] = []
  private stopped = false
  /** Avatars that arrived before the first state snapshot. */
  private pendingPhotos = new Map<string, string>()
  /** Avoid spamming avatar-req for the same missing set. */
  private lastAvatarReqKey = ''
  private lastAvatarReqAt = 0

  constructor(options: GuestSessionOptions) {
    this.code = options.code.toUpperCase()
    this.profile = {
      ...options.profile,
      photo: normalizeAvatarPhoto(options.profile.photo),
    }
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
        this.applyState(incoming)
        const meNow = this._state?.players.find((p) => p.id === this.profile.id)
        const inSession = Boolean(meNow && meNow.active !== false)
        if (!inSession) {
          // Hard-removed or soft-deactivated by the host.
          if (this._status === 'joined') this.setStatus('removed')
          return
        }
        if (this._status !== 'joined') this.setStatus('joined')
        // A resumed host marks remote players disconnected until they check
        // in again; answer immediately instead of waiting for the next
        // heartbeat interval.
        if (meNow && !meNow.connected) this.sendHello()
        if (this._state) this.onState.emit(this._state)
        this.requestMissingAvatars()
        break
      }
      case 'avatar': {
        this.applyAvatar(msg.playerId, msg.photo)
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

  private applyState(incoming: SessionState): void {
    const prevPhotos = new Map<string, string>()
    if (this._state) {
      for (const p of this._state.players) {
        if (p.photo) prevPhotos.set(p.id, p.photo)
      }
    }
    for (const [id, photo] of this.pendingPhotos) prevPhotos.set(id, photo)
    if (this.profile.photo) prevPhotos.set(this.profile.id, this.profile.photo)

    this._state = {
      ...incoming,
      players: incoming.players.map((p) => this.mergePlayerPhoto(p, prevPhotos.get(p.id))),
    }
    this.pendingPhotos.clear()
  }

  private mergePlayerPhoto(player: SessionPlayer, cached?: string): SessionPlayer {
    if (!player.hasPhoto) {
      if (!player.photo) return player
      const { photo: _photo, ...rest } = player
      return rest
    }
    if (player.photo) return player
    if (cached) return { ...player, photo: cached }
    return player
  }

  private applyAvatar(playerId: string, rawPhoto: string): void {
    const photo = normalizeAvatarPhoto(rawPhoto)
    if (!photo) return
    if (!this._state) {
      this.pendingPhotos.set(playerId, photo)
      return
    }
    const existing = this._state.players.find((p) => p.id === playerId)
    if (!existing) {
      this.pendingPhotos.set(playerId, photo)
      return
    }
    if (existing.photo === photo && existing.hasPhoto) return
    this._state = {
      ...this._state,
      players: this._state.players.map((p) =>
        p.id === playerId ? { ...p, photo, hasPhoto: true } : p,
      ),
    }
    this.onState.emit(this._state)
  }

  private requestMissingAvatars(): void {
    if (!this._state || this._status === 'removed' || this._status === 'ended') return
    const missing = this._state.players
      .filter((p) => p.hasPhoto && !p.photo)
      .map((p) => p.id)
      .sort()
    if (missing.length === 0) {
      this.lastAvatarReqKey = ''
      return
    }
    const key = missing.join(',')
    const now = this.now()
    // Debounce identical requests (state bursts) but retry after a few seconds.
    if (key === this.lastAvatarReqKey && now - this.lastAvatarReqAt < 4_000) return
    this.lastAvatarReqKey = key
    this.lastAvatarReqAt = now
    this.sendWire({ t: 'avatar-req', playerIds: missing })
  }

  private sendHello(): void {
    const player: PlayerProfile = {
      id: this.profile.id,
      name: this.profile.name,
      emoji: this.profile.emoji,
      ...(this.profile.photo ? { photo: this.profile.photo } : {}),
    }
    this.sendWire({ t: 'hello', player })
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
