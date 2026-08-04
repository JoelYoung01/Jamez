export type Unsubscribe = () => void

/** Minimal typed event emitter used across the protocol layer. */
export class Emitter<T> {
  private listeners = new Set<(value: T) => void>()

  subscribe(fn: (value: T) => void): Unsubscribe {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  emit(value: T): void {
    for (const fn of [...this.listeners]) fn(value)
  }

  clear(): void {
    this.listeners.clear()
  }
}
