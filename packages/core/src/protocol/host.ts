import { asDrawSummary, type GameEngine } from '../games/types'
import { getGameEngine } from '../games/registry'
import { normalizeAvatarPhoto, stripPlayerPhotos } from '../profile/avatar'
import type { RoomTransport } from '../transport/types'
import { Emitter, type Unsubscribe } from '../util/emitter'
import { randomId } from '../util/ids'
import type { PlayerMergeMode } from '../games/types'
import {
  hasPhoneClient,
  isPlayerActive,
  makeEnvelope,
  normalizeNickname,
  normalizeSessionPlayer,
  parseEnvelope,
  pickPlayerColor,
  seatForClientId,
  type PlayerProfile,
  type SessionPlayer,
  type SessionState,
  type WireMessage,
} from './session-state'

const ACTION_ID_FIELDS = ['playerId', 'knockerId'] as const

/** Map a phone's profile id onto the seat id inside an action payload. */
function canonicalizeAction(
  action: { type: string } & Record<string, unknown>,
  clientId: string,
  seatId: string,
): { type: string } & Record<string, unknown> {
  if (clientId === seatId) return action
  const next: { type: string } & Record<string, unknown> = { ...action }
  for (const field of ACTION_ID_FIELDS) {
    if (next[field] === clientId) next[field] = seatId
  }
  return next
}

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
  /**
   * Host player library lookup. A phone hello resolves here before a new seat
   * is created, so a known person (including a second phone) reuses their id.
   */
  resolveLibrary?: (clientId: string) => {
    id: string
    name: string
    emoji: string
    photo?: string
    clientIds: string[]
  } | null
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
  private readonly resolveLibrary?: HostSessionOptions['resolveLibrary']

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
    this.resolveLibrary = options.resolveLibrary
    this.hostId = options.hostProfile.id

    if (options.resumeFrom) {
      const engine = getGameEngine(options.resumeFrom.gameId)
      if (!engine) throw new Error(`Unknown game: ${options.resumeFrom.gameId}`)
      this.game = engine
      const hostPhoto = normalizeAvatarPhoto(options.hostProfile.photo)
      this.state = {
        ...options.resumeFrom,
        players: options.resumeFrom.players.map((p) => {
          const normalized = normalizeSessionPlayer(p)
          if (p.id === options.hostProfile.id) {
            return {
              ...normalized,
              name: options.hostProfile.name,
              emoji: options.hostProfile.emoji,
              photo: hostPhoto,
              hasPhoto: Boolean(hostPhoto),
              connected: true,
            }
          }
          return {
            ...normalized,
            // Phone seats must hello again. Host-created seats stay playable.
            connected: !hasPhoneClient(normalized),
            hasPhoto: Boolean(p.photo) || p.hasPhoto === true,
          }
        }),
      }
    } else {
      this.game = options.game
      const hostPhoto = normalizeAvatarPhoto(options.hostProfile.photo)
      const hostPlayer: SessionPlayer = {
        id: options.hostProfile.id,
        name: options.hostProfile.name,
        emoji: options.hostProfile.emoji,
        ...(hostPhoto ? { photo: hostPhoto, hasPhoto: true } : { hasPhoto: false }),
        color: pickPlayerColor([]),
        isHost: true,
        clientIds: [],
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

  /** Cap for the current config. Falls back to the engine's absolute max. */
  private tableLimit(): number {
    const configured = this.game.playerLimit?.(this.state.gameConfig)
    if (typeof configured !== 'number' || !Number.isFinite(configured)) return this.game.maxPlayers
    return Math.min(this.game.maxPlayers, Math.max(1, Math.floor(configured)))
  }

  /** Replace lobby setup (cribbage team seating) before the deal. */
  updateGameConfig(config: unknown): string | null {
    if (this.state.phase !== 'lobby') return 'Setup can only change before the game starts'
    this.mutate((s) => {
      s.gameConfig = config
    })
    return null
  }

  addLocalPlayer(profile: {
    name: string
    emoji: string
    /** Reuse a library id so a later hello from a bound phone attaches to this seat. */
    id?: string
    photo?: string
    /** Phones already bound to this library player. Empty for a host-created player. */
    clientIds?: string[]
  }): string | null {
    const limit = this.tableLimit()
    if (this.state.players.length >= limit) {
      return 'Session is full'
    }
    // Match lobbies: adding someone means they're playing. Ongoing banks
    // (Poker Bank): new seats join the roster as not present until the host
    // marks them at the table (or a remote claims the seat).
    const atTable = this.game.sessionMode !== 'ongoing'
    if (atTable && this.state.players.filter(isPlayerActive).length >= limit) {
      return 'Session is full'
    }
    const id = profile.id?.trim() || randomId(8)
    const uniqueClients = [...new Set((profile.clientIds ?? []).map((clientId) => clientId.trim()).filter(Boolean))]
    if (this.state.players.some((p) => p.id === id || p.clientIds.some((clientId) => uniqueClients.includes(clientId)))) {
      return 'That player is already in the session'
    }
    const phoneBound = uniqueClients.length > 0
    const player: SessionPlayer = {
      id,
      name: profile.name,
      emoji: profile.emoji,
      color: pickPlayerColor(this.state.players.map((p) => p.color)),
      isHost: false,
      clientIds: uniqueClients,
      connected: !phoneBound,
      joinedAt: this.now(),
      active: atTable,
      ...(profile.photo ? { photo: profile.photo, hasPhoto: true } : {}),
    }
    this.mutate((s) => {
      s.players = [...s.players, player]
      if (atTable && s.phase === 'playing' && this.game.addPlayer && s.game) {
        s.game = this.game.addPlayer(s.game, player)
      }
    })
    return null
  }

  /**
   * Update the name/emoji of a host-created player (no bound phone).
   * Phone profiles refresh from the device on hello; the host's alias lives
   * in the library, not on the seat.
   */
  updateLocalPlayer(
    playerId: string,
    patch: { name?: string; emoji?: string },
  ): string | null {
    const player = this.state.players.find((p) => p.id === playerId)
    if (!player) return 'Player not found'
    if (player.isHost) return 'The host profile is edited in Settings'
    if (hasPhoneClient(player)) return 'Only host-created players can be edited'
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

  /**
   * Mark a non-host player not present: hide them from the main “at the table”
   * list without deleting their bank / history. Remotes can check back in via
   * join; host-created guests via host “At the table” or seat claim.
   */
  deactivatePlayer(playerId: string): string | null {
    if (playerId === this.hostId) return 'The host stays at the table'
    const player = this.state.players.find((p) => p.id === playerId)
    if (!player) return 'Player not found'
    if (!isPlayerActive(player)) return null
    this.mutate((s) => {
      s.players = s.players.map((p) =>
        p.id === playerId ? { ...p, active: false, connected: hasPhoneClient(p) ? false : p.connected } : p,
      )
    })
    return null
  }

  /** Mark a not-present seat as at the table (and grant game resources if needed). */
  reactivatePlayer(playerId: string): string | null {
    const player = this.state.players.find((p) => p.id === playerId)
    if (!player) return 'Player not found'
    if (isPlayerActive(player)) return null
    const activeCount = this.state.players.filter(isPlayerActive).length
    if (activeCount >= this.tableLimit()) return 'Session is full'
    this.mutate((s) => {
      s.players = s.players.map((p) =>
        p.id === playerId ? { ...p, active: true, connected: hasPhoneClient(p) ? p.connected : true } : p,
      )
      if (s.phase === 'playing' && s.game && this.game.addPlayer) {
        const seated = s.players.find((p) => p.id === playerId)
        if (seated) s.game = this.game.addPlayer(s.game, seated)
      }
    })
    return null
  }

  startGame(): string | null {
    if (this.state.phase !== 'lobby') return 'Game already started'
    const active = this.state.players.filter(isPlayerActive)
    const count = active.length
    if (count < this.game.minPlayers) {
      return `${this.game.name} needs at least ${this.game.minPlayers} players`
    }
    const limit = this.tableLimit()
    if (count > limit) {
      return `${this.game.name} supports at most ${limit} players`
    }
    const seatingError = this.game.validateStart?.(this.state.gameConfig, active)
    if (seatingError) return seatingError
    this.mutate((s) => {
      // Keep the full roster (including not-present seats). Only people at the
      // table receive initial game resources; others join later via check-in.
      s.game = this.game.init(s.gameConfig, active)
      s.phase = 'playing'
      s.startedAt = this.now()
    })
    return null
  }

  /**
   * Snapshot standings and mark the session finished. Match games use this when
   * the ruleset ends; ongoing rooms (Poker Bank) use it to archive standings
   * before dissolving so the bank remains findable in history.
   *
   * Pass `{ asDraw: true }` to keep mid-match scores but clear winners (host
   * ended early via "End Game").
   */
  finish(opts?: { asDraw?: boolean }): string | null {
    if (this.state.phase !== 'playing') return 'Game is not in progress'
    this.mutate((s) => {
      const summary = this.game.summary(s.game, s.players)
      s.summary = opts?.asDraw ? asDrawSummary(summary) : summary
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
   * Disconnect every phone on a seat. The seat stays so the host can keep
   * playing it; those phones can hello again later and reattach.
   */
  kickPlayer(playerId: string): string | null {
    if (playerId === this.hostId) return 'The host cannot be kicked'
    const player = this.state.players.find((p) => p.id === playerId)
    if (!player) return 'Player not found'
    for (const clientId of player.clientIds) {
      this.lastSeen.delete(clientId)
      this.sendWire({ t: 'kick', to: clientId })
    }
    if (hasPhoneClient(player)) {
      this.mutate((s) => {
        s.players = s.players.map((p) => (p.id === playerId ? { ...p, connected: false } : p))
      })
    }
    return null
  }

  /**
   * Fold one seated player into another. `toId` survives, including every
   * phone bound to either seat. `mode` is how the open game treats scores.
   */
  mergePlayers(
    fromId: string,
    toId: string,
    mode: PlayerMergeMode = 'combine',
    profile?: { name?: string; emoji?: string; photo?: string },
  ): string | null {
    if (fromId === toId) return 'Pick two different players'
    if (fromId === this.hostId) return 'The host cannot be merged away'
    const from = this.state.players.find((p) => p.id === fromId)
    const to = this.state.players.find((p) => p.id === toId)
    if (!from || !to) return 'Player not found'
    const clientIds = [...new Set([...to.clientIds, ...from.clientIds])]
    const applyProfile = (player: SessionPlayer): SessionPlayer => {
      if (!profile || player.isHost) return { ...player, clientIds }
      const photo = profile.photo !== undefined ? profile.photo : player.photo
      return {
        ...player,
        clientIds,
        ...(profile.name ? { name: profile.name } : {}),
        ...(profile.emoji ? { emoji: profile.emoji } : {}),
        ...(photo ? { photo, hasPhoto: true } : {}),
      }
    }

    if (this.state.phase === 'lobby' || !this.state.game) {
      this.mutate((s) => {
        s.players = s.players
          .filter((p) => p.id !== fromId)
          .map((p) => (p.id === toId ? applyProfile(p) : p))
      })
      return null
    }
    if (this.state.phase !== 'playing') {
      return 'Players can only be merged during an open session'
    }
    this.mutate((s) => {
      if (s.game) {
        if (this.game.mergePlayers) {
          s.game = this.game.mergePlayers(s.game, fromId, toId, mode)
        } else if (this.game.removePlayer) {
          s.game = this.game.removePlayer(s.game, fromId)
        }
      }
      s.players = s.players
        .filter((p) => p.id !== fromId)
        .map((p) => (p.id === toId ? applyProfile(p) : p))
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
    const seat =
      seatForClientId(this.state.players, actorId) ??
      this.state.players.find((p) => p.id === actorId)
    const fail = (reason: string): string => {
      if (fromRemote) this.sendWire({ t: 'reject', to: actorId, reqId, reason })
      return reason
    }
    if (this.state.phase !== 'playing' || !this.state.game) {
      return fail('Game is not in progress')
    }
    if (!seat || !isPlayerActive(seat)) return fail('You are not at the table')
    if (fromRemote && seat.id !== actorId && !seat.clientIds.includes(actorId)) {
      return fail('You are not at the table')
    }
    const canonical = canonicalizeAction(action, actorId, seat.id)
    const targetId = typeof canonical.playerId === 'string' ? canonical.playerId : undefined
    if (targetId && targetId !== seat.id) {
      const target = this.state.players.find((p) => p.id === targetId)
      if (target && !isPlayerActive(target)) return fail('That player is not at the table')
    }
    const ctx = { actorId: seat.id, isHost: actorId === this.hostId, now: this.now() }
    const error = this.game.validateAction(this.state.game, canonical, ctx)
    if (error) return fail(error)
    this.mutate((s) => {
      s.game = this.game.applyAction(s.game, canonical, ctx)
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
        // Explicit leave = not present (keeps bank / history). App background
        // and reconnects use heartbeats / hello and must not go through bye.
        {
          const leaving = seatForClientId(this.state.players, msg.playerId)
          if (leaving && leaving.id !== this.hostId) {
            this.lastSeen.delete(msg.playerId)
            if (this.phoneIsConnected(leaving)) this.markClient(msg.playerId, false)
            else this.deactivatePlayer(leaving.id)
          } else {
            this.markClient(msg.playerId, false)
          }
        }
        break
      case 'hb':
        this.lastSeen.set(msg.playerId, this.now())
        this.markClient(msg.playerId, true)
        if (msg.rev < this.state.rev) this.sendState()
        break
      case 'action':
        this.lastSeen.set(msg.playerId, this.now())
        this.processAction(msg.playerId, msg.action, msg.reqId, true)
        break
      case 'sync':
        this.sendState()
        break
      case 'avatar-req':
        this.handleAvatarReq(msg.playerIds)
        break
      default:
        break // host ignores host-originated message types
    }
  }

  private handleHello(profile: PlayerProfile): void {
    this.lastSeen.set(profile.id, this.now())
    const photo = normalizeAvatarPhoto(profile.photo)
    const bound = this.resolveLibrary?.(profile.id) ?? null
    const existing =
      seatForClientId(this.state.players, profile.id) ??
      (bound ? this.state.players.find((p) => p.id === bound.id) : undefined)
    if (existing) {
      if (existing.isHost) {
        this.sendWire({ t: 'reject', to: profile.id, reason: 'That player is already in this session' })
        return
      }
      // Reconnect, or a second phone already bound to this seat.
      if (!isPlayerActive(existing)) {
        const activeCount = this.state.players.filter(isPlayerActive).length
        if (activeCount >= this.tableLimit()) {
          this.sendWire({
            t: 'reject',
            to: profile.id,
            reason: `This ${this.game.name} session is full (${this.tableLimit()} players max)`,
          })
          return
        }
      }
      const prevPhoto = existing.photo
      const clientIds = [...new Set([...existing.clientIds, profile.id, ...(bound?.clientIds ?? [])])]
      this.mutate((s) => {
        s.players = s.players.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                name: profile.name,
                emoji: profile.emoji,
                photo,
                hasPhoto: Boolean(photo),
                clientIds,
                connected: true,
                // Explicit join / rejoin checks them in at the table.
                active: true,
              }
            : p,
        )
        if (s.phase === 'playing' && s.game && this.game.addPlayer) {
          const seated = s.players.find((p) => p.id === existing.id)
          if (seated) s.game = this.game.addPlayer(s.game, seated)
        }
      })
      this.sendState()
      if (photo && photo !== prevPhoto) this.broadcastAvatar(existing.id, photo)
      return
    }
    if (this.state.players.filter(isPlayerActive).length >= this.tableLimit()) {
      this.sendWire({
        t: 'reject',
        to: profile.id,
        reason: `This ${this.game.name} session is full (${this.tableLimit()} players max)`,
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
    const id = bound?.id ?? profile.id
    const clientIds = [...new Set([...(bound?.clientIds ?? []), profile.id])]
    const player: SessionPlayer = {
      id,
      name: profile.name,
      emoji: profile.emoji,
      ...(photo ? { photo, hasPhoto: true } : { hasPhoto: false }),
      color: pickPlayerColor(this.state.players.map((p) => p.color)),
      isHost: false,
      clientIds,
      connected: true,
      joinedAt: this.now(),
      active: true,
    }
    this.mutate((s) => {
      s.players = [...s.players, player]
      if (s.phase === 'playing' && s.game && this.game.addPlayer) {
        s.game = this.game.addPlayer(s.game, player)
      }
    })
    if (photo) this.broadcastAvatar(id, photo)
  }

  private handleAvatarReq(playerIds?: string[]): void {
    const filter = playerIds && playerIds.length > 0 ? new Set(playerIds) : null
    for (const player of this.state.players) {
      if (!player.photo) continue
      if (filter && !filter.has(player.id)) continue
      this.broadcastAvatar(player.id, player.photo)
    }
  }

  private broadcastAvatar(playerId: string, photo: string): void {
    this.sendWire({ t: 'avatar', playerId, photo })
  }

  /** A phone seat stays connected while any of its phones has been seen recently. */
  private phoneIsConnected(player: SessionPlayer, now = this.now()): boolean {
    const cutoff = now - PRESENCE_TIMEOUT_MS
    return player.clientIds.some((id) => (this.lastSeen.get(id) ?? 0) >= cutoff)
  }

  private markClient(clientId: string, seen: boolean): void {
    const player = seatForClientId(this.state.players, clientId)
    if (!player || !hasPhoneClient(player)) return
    if (!seen) this.lastSeen.delete(clientId)
    const connected = this.phoneIsConnected(player)
    if (player.connected === connected) return
    this.mutate((s) => {
      s.players = s.players.map((p) => (p.id === player.id ? { ...p, connected } : p))
    })
  }

  private sweepPresence(): void {
    for (const player of this.state.players) {
      if (!hasPhoneClient(player) || !player.connected) continue
      if (!this.phoneIsConnected(player)) {
        this.mutate((s) => {
          s.players = s.players.map((p) => (p.id === player.id ? { ...p, connected: false } : p))
        })
      }
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
    // Keep photo bytes in local/host-vault state; peers fetch via avatar messages.
    this.sendWire({ t: 'state', state: stripPlayerPhotos(this.state) })
  }

  private sendWire(msg: WireMessage): void {
    this.transport.send(makeEnvelope(this.state.code, this.hostId, msg))
  }
}

export function createHostSession(options: HostSessionOptions): HostSession {
  return new HostSession(options)
}
