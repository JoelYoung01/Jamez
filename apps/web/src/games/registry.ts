import { ginRummyUI } from './gin-rummy'
import type { GameUIModule } from './types'
import { wingspanUI } from './wingspan'

const modules: GameUIModule[] = [wingspanUI, ginRummyUI]

export function getGameUI(id: string): GameUIModule | undefined {
  return modules.find((m) => m.id === id)
}
