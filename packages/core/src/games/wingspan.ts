import type { SessionPlayer } from '../protocol/session-state'
import { formatPoints, namesList, type ActionContext, type GameEngine, type GameSummary } from './types'

/**
 * Wingspan end-of-game scoring (base game, with optional Oceania nectar row).
 *
 * Final score = bird card points + bonus card points + end-of-round goal
 * points + 1 pt per egg + 1 pt per cached food + 1 pt per tucked card
 * (+ nectar points when playing with the Oceania expansion).
 * Ties are broken by the most unused food tokens; if still tied, the win is
 * shared.
 */

export interface WingspanConfig {
  /** Oceania expansion: adds the nectar scoring row (5/2 per habitat majority). */
  nectar: boolean
}

export const WINGSPAN_CATEGORIES = [
  'birds',
  'bonusCards',
  'roundGoals',
  'eggs',
  'foodOnCards',
  'tuckedCards',
  'nectar',
] as const

export type WingspanCategory = (typeof WINGSPAN_CATEGORIES)[number]

export interface WingspanSheet {
  birds: number
  bonusCards: number
  roundGoals: number
  eggs: number
  foodOnCards: number
  tuckedCards: number
  nectar: number
  /** Tiebreaker only — not part of the total. */
  unusedFood: number
  done: boolean
}

export interface WingspanState {
  config: WingspanConfig
  sheets: Record<string, WingspanSheet>
}

export type WingspanAction =
  | { type: 'setCategory'; playerId: string; category: WingspanCategory | 'unusedFood'; value: number }
  | { type: 'setDone'; playerId: string; done: boolean }

export function emptySheet(): WingspanSheet {
  return {
    birds: 0,
    bonusCards: 0,
    roundGoals: 0,
    eggs: 0,
    foodOnCards: 0,
    tuckedCards: 0,
    nectar: 0,
    unusedFood: 0,
    done: false,
  }
}

export function wingspanTotal(sheet: WingspanSheet, config: WingspanConfig): number {
  return (
    sheet.birds +
    sheet.bonusCards +
    sheet.roundGoals +
    sheet.eggs +
    sheet.foodOnCards +
    sheet.tuckedCards +
    (config.nectar ? sheet.nectar : 0)
  )
}

interface RankedPlayer {
  playerId: string
  score: number
  unusedFood: number
  rank: number
}

/** Competition ranking: score desc, then unused-food tiebreaker desc. */
export function wingspanRanking(state: WingspanState): RankedPlayer[] {
  const rows = Object.entries(state.sheets).map(([playerId, sheet]) => ({
    playerId,
    score: wingspanTotal(sheet, state.config),
    unusedFood: sheet.unusedFood,
    rank: 0,
  }))
  rows.sort((a, b) => b.score - a.score || b.unusedFood - a.unusedFood)
  for (let i = 0; i < rows.length; i++) {
    const prev = rows[i - 1]
    const row = rows[i]!
    if (prev && prev.score === row.score && prev.unusedFood === row.unusedFood) {
      row.rank = prev.rank
    } else {
      row.rank = i + 1
    }
  }
  return rows
}

function validateValue(value: number): string | null {
  if (!Number.isInteger(value)) return 'Score must be a whole number'
  if (value < 0) return 'Score cannot be negative'
  if (value > 999) return 'Score is too large'
  return null
}

export const wingspanEngine: GameEngine<WingspanConfig, WingspanState, WingspanAction> = {
  id: 'wingspan',
  name: 'Wingspan',
  tagline: 'End-of-game scoring for the modern classic',
  emoji: '🪶',
  accentColor: '#34d399',
  minPlayers: 1,
  maxPlayers: 5,
  allowLateJoin: true,

  defaultConfig(): WingspanConfig {
    return { nectar: false }
  },

  init(config, players) {
    const sheets: Record<string, WingspanSheet> = {}
    for (const player of players) sheets[player.id] = emptySheet()
    return { config, sheets }
  },

  validateAction(state, action, ctx: ActionContext) {
    const sheet = state.sheets[action.playerId]
    if (!sheet) return 'Unknown player'
    if (action.playerId !== ctx.actorId && !ctx.isHost) {
      return 'You can only edit your own sheet'
    }
    if (action.type === 'setCategory') {
      if (action.category === 'nectar' && !state.config.nectar) {
        return 'Nectar is not enabled for this game'
      }
      return validateValue(action.value)
    }
    return null
  },

  applyAction(state, action) {
    const sheet = state.sheets[action.playerId]!
    const nextSheet: WingspanSheet =
      action.type === 'setCategory'
        ? { ...sheet, [action.category]: action.value }
        : { ...sheet, done: action.done }
    return { ...state, sheets: { ...state.sheets, [action.playerId]: nextSheet } }
  },

  // Wingspan sessions are finished explicitly by the host.
  isFinished() {
    return false
  },

  summary(state, players): GameSummary {
    const ranking = wingspanRanking(state)
    const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown'
    const winners = ranking.filter((r) => r.rank === 1)
    const winnerIds = winners.map((w) => w.playerId)
    const top = winners[0]
    const headline =
      winners.length === 1 && top
        ? `${nameOf(top.playerId)} wins with ${formatPoints(top.score)}`
        : top
          ? `${namesList(winnerIds.map(nameOf))} share the win at ${formatPoints(top.score)}`
          : 'Game finished'
    return {
      headline,
      winnerIds,
      entries: ranking.map((r) => ({
        playerId: r.playerId,
        rank: r.rank,
        score: r.score,
        scoreText: formatPoints(r.score),
      })),
    }
  },

  addPlayer(state, player) {
    if (state.sheets[player.id]) return state
    return { ...state, sheets: { ...state.sheets, [player.id]: emptySheet() } }
  },

  removePlayer(state, playerId) {
    if (!state.sheets[playerId]) return state
    const sheets = { ...state.sheets }
    delete sheets[playerId]
    return { ...state, sheets }
  },
}
