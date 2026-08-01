import { ginRummyEngine } from './gin-rummy'
import type { GameEngine } from './types'
import { wingspanEngine } from './wingspan'

/**
 * Every supported game registers its engine here. Apps keep a parallel
 * registry of UI modules keyed by the same ids (see docs/adding-a-game.md).
 */
export const gameEngines: ReadonlyArray<GameEngine<any, any, any>> = [
  wingspanEngine,
  ginRummyEngine,
]

export function getGameEngine(id: string): GameEngine<any, any, any> | undefined {
  return gameEngines.find((g) => g.id === id)
}
