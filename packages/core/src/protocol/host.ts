import type { GameEngine } from '../games/types'
import { getGameEngine } from '../games/registry'
import type { RoomTransport } from '../transport/types'
import { Emitter, type Unsubscribe } from '../util/emitter'
import { randomId } from '../util/ids'
import {
  makeEnvelope,
  normalizeNickname,
  parseEnvelope,
  pickPlayerColor,
  type PlayerProfile,
  type SessionPlayer,
  type SessionState,
  type WireMessage,
} from './session-state'

const PING_INTERVAL_MS = 10_000
const PRESENCE_SWEEP_MS = 5_000
const PRESENCE_TIMEOUT_MS = 40_000
const BROADCAST_THROTTLE_MS = 120

export interface HostSessionOptions {
  code: string
  game: GameEngine<any, any, any>
  gameConfig?: unknown
  hostProfile: PlayerProfile
  transport: RoomTransport
  /** Called after every state change; apps persist this for crash/reload resume. */
  onSnapshot?: (state: SessionState) => void
  /** Resume a previous session (e.g. after the host app reloads). */
  resumeFrom?: SessionState
  /** Optional display nickname for a brand-new session. */
  nickname?: string
  now?: () => number
}

/**
 * The authoritative side of a session. Exactly one device runs a HostSession;
 * everyone else runs a GuestSession. All game state lives here and is
 * broadcast to guests; nothing is ever stored off-device.
 */
export class HostSession {
  readonly onState = new Emitter<SessionState>()
  readonly transport: RoomTransport

  private state: SessionState
  private readonly game: GameEngine<any, any, any>
  private readonly hostId: string
  private readonly now: () => number
  private readonly onSnapshot?: (state: SessionState) => void

  private lastSeen = new Map<string, number>()
  private timers: ReturnType<typeof setInterval>[] = []
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null
  private broadcastDirty = false
  private unsubscribes: Unsubscribe[] = []
  private stopped = false

  constructor(options: HostSessionOptions) {
    this.transport = options.transport
    this.now = options.now ?? (() => Date.now())
    this.onSnapshot = options.onSnapshot
    this.hostId = options.hostProfile.id

    if (options.resumeFrom) {
      const engine = getGameEngine(options.resumeFrom.gameId)
      if (!engine) throw new Error(`Unknown game: ${options.resumeFrom.gameId}`)
      this.game = engine
      this.state = {
        ...options.resumeFrom,
        players: options.resumeFrom.players.map((p) => ({
          ...p,
          connected: !p.remote, // remote guests must re-hello
        })),
      }
    } else {
      this.game = options.game
      const hostPlayer: SessionPlayer = {
        ...options.hostProfile,
        color: pickPlayerColor([]),
        isHost: true,
        remote: false,
        connected: true,
        joinedAt: this.now(),
      }
      const nickname = normalizeNickname(options.nickname)
      this.state = {
        v: 1,
        sessionId: randomId(8),
        code: options.code,
        gameId: this.game.id,
        gameConfig: options.gameConfig ?? this.game.defaultConfig(),
        phase: 'lobby',
        rev: 1,
        players: [hostPlayer],
        game: null,
        createdAt: this.now(),
        ...(nickname ? { nickname } : {}),
      }
    }

    this.unsubscribes.push(this.transport.onMessage.subscribe((p) => this.handlePayload(p)))
  }

  get current(): SessionState {
    return this.state
  }

  get code(): string {
    return this.state.code
  }

  get hostPlayerId(): string {
    return this.hostId
  }

  start(): void {
    this.transport.start()
    this.timers.push(
      setInterval(() => this.sendWire({ t: 'ping', rev: this.state.rev }), PING_INTERVAL_MS),
      setInterval(() => this.sweepPresence(), PRESENCE_SWEEP_MS),
    )
    // Persist immediately so create-time nickname / resume state survive a
    // crash before the first mutate, then announce to any waiting guests.
    this.onSnapshot?.(this.state)
    this.broadcastState()
  }

  /** Politely end the session for everyone and release the transport. */
  end(): void {
    if (this.stopped) return
    this.sendWire({ t: 'ended' })
    this.stop()
  }

  /** Tear down timers/transport without notifying guests (e.g. page unload). */
  stop(): void {
    if (this.stopped) return
    this.stopped = true
    for (const t of this.timers) clearInterval(t)
    if (this.broadcastTimer) clearTimeout(this.broadcastTimer)
    for (const u of this.unsubscribes) u()
    this.transport.stop()
  }

  /** Set or clear the optional session nickname (host-only). */
  setNickname(nickname: string | undefined | null): void {
    const next = normalizeNickname(nickname)
    const prev = normalizeNickname(this.state.nickname)
    if (next === prev) return
    this.mutate((s) => {
      if (next) s.nickname = next
      else delete s.nickname
    })
  }

  // -- Lobby management ------------------------------------------------------

  addLocalPlayer(profile: { name: string; emoji: string }): string | null {
    if (this.state.players.length >= this.game.maxPlayers) return 'Session is full'
    const player: SessionPlayer = {
      id: randomId(8),
      name: profile.name,
      emoji: profile.emoji,
      color: pickPlayerColor(this.state.players.map((p) => p.color)),
      isHost: false,
      remote: false,
      connected: true,
      joinedAt: this.now(),
    }
    this.mutate((s) => {
      s.players = [...s.players, player]
      if (s.phase === 'playing' && this.game.addPlayer && s.game) {
        s.game = this.game.addPlayer(s.game, player)
      }
    })
    return null
  }

  /**
   * Update the name/emoji of a host-created guest seat (`remote: false`).
   * Remote joiners and the host edit their own profile on-device instead.
   */
  updateLocalPlayer(
    playerId: string,
    patch: { name?: string; emoji?: string },
  ): string | null {
    const player = this.state.players.find((p) => p.id === playerId)
    if (!player) return 'Player not found'
    if (player.isHost) return 'The host profile is edited in Settings'
    if (player.remote) return 'Only host-created guest seats can be edited'
    const name =
      patch.name !== undefined ? patch.name.trim().slice(0, 24) : player.name
    const emoji = patch.emoji !== undefined ? patch.emoji : player.emoji
    if (!name) return 'Name is required'
    if (name === player.name && emoji === player.emoji) return null
    this.mutate((s) => {
      s.players = s.players.map((p) =>
        p.id === playerId ? { ...p, name, emoji } : p,
      )
    })
    return null
  }

  removePlayer(playerId: string): string | null {
    if (playerId === this.hostId) return 'The host cannot be removed'
    const player = this.state.players.find((p) => p.id === playerId)
    if (!player) return 'Player not found'
    if (this.state.phase === 'playing') {
      if (!this.game.removePlayer) return `Players cannot leave a ${this.game.name} game in progress`
      this.mutate((s) => {
        s.players = s.players.filter((p) => p.id !== playerId)
        if (s.game) s.game = this.game.removePlayer!(s.game, playerId)
      })
      return null
    }
    this.mutate((s) => {
      s.players = s.players.filter((p) => p.id !== playerId)
    })
    return null
  }

  startGame(): string | null {
    if (this.state.phase !== 'lobby') return 'Game already started'
    const count = this.state.players.length
    if (count < this.game.minPlayers) {
      return `${this.game.name} needs at least ${this.game.minPlayers} players`
    }
    if (count > this.game.maxPlayers) {
      return `${this.game.name} supports at most ${this.game.maxPlayers} players`
    }
    this.mutate((s) => {
      s.game = this.game.init(s.gameConfig, s.players)
      s.phase = 'playing'
      s.startedAt = this.now()
    })
    return null
  }

  /**
   * Snapshot standings and mark the session finished. Match games use this when
   * the ruleset ends; ongoing rooms (Poker Bank) use it to archive standings
   * before dissolving so the bank remains findable in history.
   */
  finish(): string | null {
    if (this.state.phase !== 'playing') return 'Game is not in progress'
    this.mutate((s) => {
      s.summary = this.game.summary(s.game, s.players)
      s.phase = 'finished'
      s.finishedAt = this.now()
    })
    return null
  }

  /** Start a fresh match with the same players, config, and join code. */
  rematch(): string | null {
    if (this.state.phase !== 'finished') return 'Finish the current game first'
    if (this.game.sessionMode === 'ongoing') {
      return 'Ongoing games keep their state — park or dissolve instead of rematch'
    }
    this.mutate((s) => {
      s.sessionId = randomId(8)
      s.game = this.game.init(s.gameConfig, s.players)
      s.phase = 'playing'
      s.startedAt = this.now()
      s.finishedAt = undefined
      s.summary = undefined
    })
    return null
  }

  /**
   * Let a joined player take over a host-created guest seat. The claimer keeps
   * their device identity and receives the seat's game resources (replacing
   * whatever they had); the guest seat is removed from the session.
   */
  claimSeat(claimerId: string, seatId: string): string | null {
    if (claimerId === seatId) return 'Pick two different players'
    if (!this.game.claimSeat) {
      return `${this.game.name} does not support claiming seats`
    }
    const claimer = this.state.players.find((p) => p.id === claimerId)
    const seat = this.state.players.find((p) => p.id === seatId)
    if (!claimer) return 'Claiming player not found'
    if (!seat) return 'Seat not found'
    if (seat.isHost) return 'The host seat cannot be claimed'
    if (seat.remote) return 'Only host-created guest seats can be claimed'
    if (claimer.isHost) return 'The host cannot claim a guest seat'
    if (this.state.phase === 'lobby') {
      // Lobby: drop the guest seat; claimer is already seated with their device id.
      this.mutate((s) => {
        s.players = s.players.filter((p) => p.id !== seatId)
      })
      return null
    }
    if (this.state.phase !== 'playing' || !this.state.game) {
      return 'Seats can only be claimed during an open session'
    }
    this.mutate((s) => {
      s.game = this.game.claimSeat!(s.game, seatId, claimerId)
      s.players = s.players.filter((p) => p.id !== seatId)
    })
    return null
  }

  /**
   * Merge one player's game resources into another, then remove the source.
   *
   * Rules:
   * - The host seat can never be removed (`fromId` cannot be the host).
   * - Guest seat (`remote: false`) + real player (`remote: true`): the player
   *   always survives (`toId` must be the remote player).
   * - Player + player (or guest + guest): the host chooses `toId`.
   */
  mergePlayers(fromId: string, toId: string): string | null {
    if (fromId === toId) return 'Pick two different players'
    if (!this.game.mergePlayers) {
      return `${this.game.name} does not support merging players`
    }
    if (fromId === this.hostId) return 'The host cannot be merged away'
    const from = this.state.players.find((p) => p.id === fromId)
    const to = this.state.players.find((p) => p.id === toId)
    if (!from || !to) return 'Player not found'

    const fromIsGuest = !from.remote && !from.isHost
    const toIsGuest = !to.remote && !to.isHost
    const fromIsPlayer = from.remote || from.isHost
    const toIsPlayer = to.remote || to.isHost

    if (fromIsGuest && toIsPlayer) {
      // ok — guest folds into player
    } else if (fromIsPlayer && toIsGuest) {
      return 'When merging a guest with a player, the player must receive the balance'
    } else if (fromIsGuest && toIsGuest) {
      // ok — host picks survivor
    } else if (fromIsPlayer && toIsPlayer) {
      // ok — host picks survivor
    }

    if (this.state.phase === 'lobby') {
      this.mutate((s) => {
        s.players = s.players.filter((p) => p.id !== fromId)
      })
      return null
    }
    if (this.state.phase !== 'playing' || !this.state.game) {
      return 'Players can only be merged during an open session'
    }
    this.mutate((s) => {
      s.game = this.game.mergePlayers!(s.game, fromId, toId)
      s.players = s.players.filter((p) => p.id !== fromId)
    })
    return null
  }

  // -- Actions ---------------------------------------------------------------

  /** Apply an action from the host device (host UI or a local player's row). */
  applyAction(action: { type: string } & Record<string, unknown>, actorId?: string): string | null {
    return this.processAction(actorId ?? this.hostId, action)
  }

  private processAction(
    actorId: string,
    action: { type: string } & Record<string, unknown>,
    reqId?: string,
    fromRemote = false,
  ): string | null {
    const fail = (reason: string): string => {
      if (fromRemote) this.sendWire({ t: 'reject', to: actorId, reqId, reason })
      return reason
    }
    if (this.state.phase !== 'playing' || !this.state.game) {
      return fail('Game is not in progress')
    }
    const actor = this.state.players.find((p) => p.id === actorId)
    if (!actor) return fail('You are not in this session')
    const ctx = { actorId, isHost: actorId === this.hostId, now: this.now() }
    const error = this.game.validateAction(this.state.game, action, ctx)
    if (error) return fail(error)
    this.mutate((s) => {
      s.game = this.game.applyAction(s.game, action, ctx)
      if (this.game.isFinished(s.game)) {
        s.summary = this.game.summary(s.game, s.players)
        s.phase = 'finished'
        s.finishedAt = ctx.now
      }
    })
    return null
  }

  // -- Wire handling ---------------------------------------------------------

  private handlePayload(payload: unknown): void {
    const env = parseEnvelope(payload, this.state.code)
    if (!env) return
    const msg = env.msg
    switch (msg.t) {
      case 'hello':
        this.handleHello(msg.player)
        break
      case 'bye':
        this.markConnected(msg.playerId, false)
        break
      case 'hb':
        this.lastSeen.set(msg.playerId, this.now())
        this.markConnected(msg.playerId, true)
        if (msg.rev < this.state.rev) this.sendState()
        break
      case 'action':
        this.lastSeen.set(msg.playerId, this.now())
        this.processAction(msg.playerId, msg.action, msg.reqId, true)
        break
      case 'sync':
        this.sendState()
        break
      default:
        break // host ignores host-originated message types
    }
  }

  private handleHello(profile: PlayerProfile): void {
    this.lastSeen.set(profile.id, this.now())
    const existing = this.state.players.find((p) => p.id === profile.id)
    if (existing) {
      // Reconnect (or profile update) for a known player.
      this.mutate((s) => {
        s.players = s.players.map((p) =>
          p.id === profile.id
            ? { ...p, name: profile.name, emoji: profile.emoji, connected: true }
            : p,
        )
      })
      this.sendState()
      return
    }
    if (this.state.players.length >= this.game.maxPlayers) {
      this.sendWire({
        t: 'reject',
        to: profile.id,
        reason: `This ${this.game.name} session is full (${this.game.maxPlayers} players max)`,
      })
      return
    }
    if (this.state.phase === 'finished') {
      this.sendWire({ t: 'reject', to: profile.id, reason: 'This game has already finished' })
      return
    }
    if (this.state.phase === 'playing' && !this.game.allowLateJoin) {
      this.sendWire({
        t: 'reject',
        to: profile.id,
        reason: `${this.game.name} has already started and does not allow late joins`,
      })
      return
    }
    const player: SessionPlayer = {
      ...profile,
      color: pickPlayerColor(this.state.players.map((p) => p.color)),
      isHost: false,
      remote: true,
      connected: true,
      joinedAt: this.now(),
    }
    this.mutate((s) => {
      s.players = [...s.players, player]
      if (s.phase === 'playing' && s.game && this.game.addPlayer) {
        s.game = this.game.addPlayer(s.game, player)
      }
    })
  }

  private markConnected(playerId: string, connected: boolean): void {
    const player = this.state.players.find((p) => p.id === playerId)
    if (!player || !player.remote || player.connected === connected) return
    this.mutate((s) => {
      s.players = s.players.map((p) => (p.id === playerId ? { ...p, connected } : p))
    })
  }

  private sweepPresence(): void {
    const cutoff = this.now() - PRESENCE_TIMEOUT_MS
    for (const player of this.state.players) {
      if (!player.remote || !player.connected) continue
      const seen = this.lastSeen.get(player.id) ?? 0
      if (seen < cutoff) this.markConnected(player.id, false)
    }
  }

  // -- State fan-out ----------------------------------------------------------

  private mutate(fn: (draft: SessionState) => void): void {
    const draft: SessionState = { ...this.state }
    fn(draft)
    draft.rev = this.state.rev + 1
    this.state = draft
    this.onState.emit(this.state)
    this.onSnapshot?.(this.state)
    this.scheduleBroadcast()
  }

  private scheduleBroadcast(): void {
    // Coalesce bursts (e.g. stepper taps) into at most ~8 broadcasts/second.
    if (this.broadcastTimer) {
      this.broadcastDirty = true
      return
    }
    this.broadcastState()
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null
      if (this.broadcastDirty) {
        this.broadcastDirty = false
        this.broadcastState()
      }
    }, BROADCAST_THROTTLE_MS)
  }

  private broadcastState(): void {
    this.sendState()
  }

  private sendState(): void {
    this.sendWire({ t: 'state', state: this.state })
  }

  private sendWire(msg: WireMessage): void {
    this.transport.send(makeEnvelope(this.state.code, this.hostId, msg))
  }
}

export function createHostSession(options: HostSessionOptions): HostSession {
  return new HostSession(options)
}
