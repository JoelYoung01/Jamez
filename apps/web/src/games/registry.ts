import { DicesIcon, type LucideIcon } from 'lucide-react'
import { ginRummyUI } from './gin-rummy'
import { pokerBankUI } from './poker-bank'
import type { GameUIModule } from './types'
import { wingspanUI } from './wingspan'

const modules: GameUIModule[] = [wingspanUI, ginRummyUI, pokerBankUI]

export function getGameUI(id: string): GameUIModule | undefined {
  return modules.find((m) => m.id === id)
}

/** Icon for a game id, falling back to dice for unknown/legacy games. */
export function getGameIcon(id: string): LucideIcon {
  return getGameUI(id)?.icon ?? DicesIcon
}
