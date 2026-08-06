import {
  getGameEngine,
  ginTotals,
  wingspanRanking,
  type GinState,
  type SessionPhase,
  type SessionState,
  type WingspanState,
} from '@jamez/core'
import type { LiveActivity } from 'expo-widgets'
import { Platform } from 'react-native'
import SessionLiveActivity, { type SessionLiveProps } from '@/widgets/SessionLiveActivity'
import type { SessionRole } from './session-store'

let activity: LiveActivity<SessionLiveProps> | null = null
let activeCode: string | null = null
let lastKey = ''

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

function trailingText(state: SessionState): string {
  if (state.phase === 'lobby') return state.code
  if (state.phase === 'finished') return 'Done'
  const lines = standingsLines(state)
  // Prefer a short score fragment from the leader line ("12" from "1. 🦊 Ada · 12")
  const leader = lines[0]
  if (leader) {
    const score = leader.split('·').pop()?.trim()
    if (score) return score
  }
  return phaseLabel(state.phase)
}

export function buildSessionLiveProps(
  state: SessionState,
  role: SessionRole,
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
  }
}

function deepLinkForCode(code: string): string {
  return `jamez://session/${code}`
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

  // Guests can be attached before the first host state arrives.
  const props: SessionLiveProps = state
    ? buildSessionLiveProps(state, role)
    : {
        gameName: 'Jamez',
        code,
        phase: 'lobby',
        role,
        statusLine: role === 'host' ? 'Starting session…' : 'Connecting…',
        trailing: code,
        lines: [],
        accentColor: '#fbbf24',
      }

  const key = `${code}:${props.phase}:${props.statusLine}:${props.lines.join('|')}:${props.trailing}`
  if (key === lastKey && activity && activeCode === code) return

  try {
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
    lastKey = key
  } catch {
    // Live Activities need iOS 16.2+ and the user to have them enabled.
    activity = null
    activeCode = null
    lastKey = ''
  }
}

export async function endSessionLiveActivity(
  policy: 'immediate' | 'default' = 'default',
): Promise<void> {
  if (Platform.OS !== 'ios') return
  const current = activity
  activity = null
  activeCode = null
  lastKey = ''
  if (!current) {
    try {
      const existing = SessionLiveActivity.getInstances()
      await Promise.all(existing.map((instance) => instance.end(policy)))
    } catch {
      // ignore
    }
    return
  }
  try {
    await current.end(policy)
  } catch {
    // ignore
  }
}
