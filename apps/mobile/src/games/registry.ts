import { DicesIcon, type LucideIcon } from 'lucide-react-native'
import { cribbageUI } from './cribbage'
import { flip7UI } from './flip-7'
import { ginRummyUI } from './gin-rummy'
import { handAndFootUI } from './hand-and-foot'
import { pokerBankUI } from './poker-bank'
import type { GameUIModule } from './types'
import { wingspanUI } from './wingspan'

const modules: GameUIModule[] = [
  wingspanUI,
  ginRummyUI,
  cribbageUI,
  flip7UI,
  handAndFootUI,
  pokerBankUI,
]

export function getGameUI(id: string): GameUIModule | undefined {
  return modules.find((m) => m.id === id)
}

/** Icon for a game id, falling back to dice for unknown/legacy games. */
export function getGameIcon(id: string): LucideIcon {
  return getGameUI(id)?.icon ?? DicesIcon
}
