import {
  getGameEngine,
  ginTotals,
  wingspanRanking,
  type GinState,
  type SessionPhase,
  type SessionState,
  type WingspanState,
} from '@jamez/core'
import { Asset } from 'expo-asset'
import { File } from 'expo-file-system'
import type { LiveActivity } from 'expo-widgets'
import { widgetsDirectory } from 'expo-widgets'
import { Platform } from 'react-native'
import SessionLiveActivity, { type SessionLiveProps } from '@/widgets/SessionLiveActivity'
import type { SessionRole } from './session-store'

let activity: LiveActivity<SessionLiveProps> | null = null
let activeCode: string | null = null
let lastKey = ''
/** Cached `file://` URI in the shared widgets directory; `undefined` until first resolve. */
let cachedIconUri: string | null | undefined
let iconResolve: Promise<string | null> | null = null
/** Bumps when a newer sync supersedes an in-flight async start/update. */
let syncGeneration = 0

function phaseLabel(phase: SessionPhase): string {
  if (phase === 'lobby') return 'Lobby'
  if (phase === 'finished') return 'Finished'
  return 'Playing'
}

function standingsLines(state: SessionState): string[] {
  const byId = new Map(state.players.map((p) => [p.id, p]))

  if (state.phase === 'finished' && state.summary) {
    return [...state.summary.entries]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 4)
      .map((entry) => {
        const player = byId.get(entry.playerId)
        const name = player?.name ?? 'Player'
        return `${entry.rank}. ${player?.emoji ?? ''} ${name} · ${entry.scoreText}`.trim()
      })
  }

  if (state.phase === 'playing' && state.game) {
    if (state.gameId === 'gin-rummy') {
      const totals = ginTotals(state.game as GinState)
      return state.players
        .map((p) => ({ p, score: totals[p.id] ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(({ p, score }, i) => `${i + 1}. ${p.emoji} ${p.name} · ${score}`)
    }
    if (state.gameId === 'wingspan') {
      return wingspanRanking(state.game as WingspanState)
        .slice(0, 4)
        .map((row) => {
          const player = byId.get(row.playerId)
          const name = player?.name ?? 'Player'
          return `${row.rank}. ${player?.emoji ?? ''} ${name} · ${row.score}`.trim()
        })
    }
  }

  return state.players.slice(0, 4).map((p) => `${p.emoji} ${p.name}`)
}

function statusLine(state: SessionState): string {
  if (state.phase === 'finished' && state.summary?.headline) return state.summary.headline
  if (state.phase === 'lobby') {
    const n = state.players.length
    return `Lobby · ${n} ${n === 1 ? 'player' : 'players'}`
  }
  const lines = standingsLines(state)
  return lines[0] ?? 'Game in progress'
}

/** Compact Dynamic Island trailing — always the join code (short + useful). */
function trailingText(state: SessionState): string {
  return state.code
}

/**
 * Copy the bundled app icon into the App Group so the Live Activity can read it.
 * Widgets cannot access the main app sandbox — only `widgetsDirectory`.
 */
async function ensureLiveActivityIconUri(): Promise<string | null> {
  if (cachedIconUri !== undefined) return cachedIconUri
  if (iconResolve) return iconResolve

  iconResolve = (async () => {
    try {
      const dir = widgetsDirectory
      if (!dir) {
        cachedIconUri = null
        return null
      }
      const [asset] = await Asset.loadAsync(require('../../assets/images/icon.png'))
      const localUri = asset.localUri
      if (!localUri) {
        cachedIconUri = null
        return null
      }
      const dest = new File(dir, 'app-icon.png')
      await new File(localUri).copy(dest, { overwrite: true })
      cachedIconUri = dest.uri
      return cachedIconUri
    } catch {
      cachedIconUri = null
      return null
    } finally {
      iconResolve = null
    }
  })()

  return iconResolve
}

export function buildSessionLiveProps(
  state: SessionState,
  role: SessionRole,
  iconUri = '',
): SessionLiveProps {
  const game = getGameEngine(state.gameId)
  return {
    gameName: game?.name ?? state.gameId,
    code: state.code,
    phase: state.phase,
    role,
    statusLine: statusLine(state),
    trailing: trailingText(state),
    lines: standingsLines(state),
    accentColor: game?.accentColor ?? '#fbbf24',
    iconUri,
  }
}

function deepLinkForCode(code: string): string {
  return `jamez://session/${code}`
}

function applyLiveActivity(props: SessionLiveProps, code: string): void {
  if (activity && activeCode && activeCode !== code) {
    void activity.end('immediate')
    activity = null
  }

  if (!activity) {
    const existing = SessionLiveActivity.getInstances()[0]
    if (existing) {
      activity = existing
      void activity.update(props)
    } else {
      activity = SessionLiveActivity.start(props, deepLinkForCode(code))
    }
    activeCode = code
  } else {
    void activity.update(props)
  }
}

/**
 * Keep a single Live Activity in sync with the active host/guest session.
 * No-ops on non-iOS, when Live Activities are disabled, or when unavailable.
 */
export function syncSessionLiveActivity(opts: {
  role: SessionRole | null
  code: string | null
  state: SessionState | null
}): void {
  if (Platform.OS !== 'ios') return

  const { role, code, state } = opts
  if (!role || !code) {
    void endSessionLiveActivity('immediate')
    return
  }

  const generation = ++syncGeneration

  void (async () => {
    const iconUri = (await ensureLiveActivityIconUri()) ?? ''
    if (generation !== syncGeneration) return

    // Guests can be attached before the first host state arrives.
    const props: SessionLiveProps = state
      ? buildSessionLiveProps(state, role, iconUri)
      : {
          gameName: 'Jamez',
          code,
          phase: 'lobby',
          role,
          statusLine: role === 'host' ? 'Starting session…' : 'Connecting…',
          trailing: code,
          lines: [],
          accentColor: '#fbbf24',
          iconUri,
        }

    const key = `${code}:${props.phase}:${props.statusLine}:${props.lines.join('|')}:${props.trailing}:${iconUri}`
    if (key === lastKey && activity && activeCode === code) return

    try {
      applyLiveActivity(props, code)
      lastKey = key
    } catch {
      // Live Activities need iOS 16.2+ and the user to have them enabled.
      activity = null
      activeCode = null
      lastKey = ''
    }
  })()
}

export async function endSessionLiveActivity(
  policy: 'immediate' | 'default' = 'immediate',
): Promise<void> {
  if (Platform.OS !== 'ios') return
  syncGeneration += 1
  const current = activity
  activity = null
  activeCode = null
  lastKey = ''
  // Always sweep ActivityKit instances: the module ref can be stale after reload,
  // and `default` dismissal leaves the Lock Screen card up for hours — callers
  // that mean "session is gone" should pass `immediate` (the new default).
  try {
    const existing = SessionLiveActivity.getInstances()
    const targets = new Set(existing)
    if (current) targets.add(current)
    await Promise.all([...targets].map((instance) => instance.end(policy)))
  } catch {
    // Live Activities unavailable / already dismissed.
  }
}
