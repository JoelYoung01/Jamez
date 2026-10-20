import { normalizeAvatarPhoto } from '../profile/avatar'
import type { RoomTransport } from '../transport/types'
import { Emitter, type Unsubscribe } from '../util/emitter'
import { makeEnvelope, parseEnvelope, type PlayerProfile } from './session-state'

export interface EnrollHostOptions {
  code: string
  hostId: string
  transport: RoomTransport
  onEnroll: (player: PlayerProfile) => 'added' | 'updated'
}

/**
 * Short-lived room used only to collect a phone's profile into the host library.
 * Stop it when the enroll screen closes; that invalidates the code.
 */
export class EnrollHost {
  readonly transport: RoomTransport
  private readonly code: string
  private readonly hostId: string
  private readonly onEnroll: EnrollHostOptions['onEnroll']
  private unsubscribes: Unsubscribe[] = []
  private stopped = false

  constructor(options: EnrollHostOptions) {
    this.code = options.code.toUpperCase()
    this.hostId = options.hostId
    this.transport = options.transport
    this.onEnroll = options.onEnroll
    this.unsubscribes.push(this.transport.onMessage.subscribe((payload) => this.handle(payload)))
  }

  start(): void {
    this.transport.start()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    for (const unsubscribe of this.unsubscribes) unsubscribe()
    this.transport.stop()
  }

  private handle(payload: unknown): void {
    if (this.stopped) return
    const env = parseEnvelope(payload, this.code)
    if (!env || env.msg.t !== 'enroll') return
    const player = {
      ...env.msg.player,
      photo: normalizeAvatarPhoto(env.msg.player.photo),
    }
    const result = this.onEnroll(player)
    this.transport.send(
      makeEnvelope(this.code, this.hostId, {
        t: 'enrolled',
        to: player.id,
        name: result === 'added' ? player.name : player.name,
      }),
    )
  }
}

export interface EnrollGuestOptions {
  code: string
  profile: PlayerProfile
  transport: RoomTransport
}

/** Phone side of enroll. Resolves once the host has stored the profile. */
export class EnrollGuest {
  readonly onEnrolled = new Emitter<void>()
  private readonly code: string
  private readonly profile: PlayerProfile
  readonly transport: RoomTransport
  private unsubscribes: Unsubscribe[] = []
  private stopped = false

  constructor(options: EnrollGuestOptions) {
    this.code = options.code.toUpperCase()
    this.profile = {
      ...options.profile,
      photo: normalizeAvatarPhoto(options.profile.photo),
    }
    this.transport = options.transport
    this.unsubscribes.push(
      this.transport.onMessage.subscribe((payload) => this.handle(payload)),
      this.transport.onStatus.subscribe((status) => {
        if (status === 'connected') this.send()
      }),
    )
  }

  start(): void {
    this.transport.start()
    if (this.transport.status === 'connected') this.send()
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    for (const unsubscribe of this.unsubscribes) unsubscribe()
    this.transport.stop()
  }

  private send(): void {
    this.transport.send(
      makeEnvelope(this.code, this.profile.id, { t: 'enroll', player: this.profile }),
    )
  }

  private handle(payload: unknown): void {
    const env = parseEnvelope(payload, this.code)
    if (!env || env.msg.t !== 'enrolled' || env.msg.to !== this.profile.id) return
    this.onEnrolled.emit()
  }
}
