import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  computeStats,
  type HistoryRecord,
  type HistoryStore,
  type Stats,
} from '@jamez/core'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'jamez.history.v1'

let cache: HistoryRecord[] = []
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // history stays in memory for this run
  }
}

// Load once at startup; the hook re-renders when it lands.
void (async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as HistoryRecord[]
      if (Array.isArray(parsed)) {
        // Merge instead of replace: a game may have finished before load.
        const existingIds = new Set(cache.map((r) => r.id))
        cache = [...cache, ...parsed.filter((r) => !existingIds.has(r.id))]
        notify()
      }
    }
  } catch {
    // corrupted/unavailable storage -> start fresh
  }
})()

export const historyStore: HistoryStore = {
  async list() {
    return [...cache].sort((a, b) => b.finishedAt - a.finishedAt)
  },
  async save(record) {
    cache = [...cache.filter((r) => r.id !== record.id), record]
    notify()
    await persist()
  },
  async remove(id) {
    cache = cache.filter((r) => r.id !== id)
    notify()
    await persist()
  },
  async clear() {
    cache = []
    notify()
    await persist()
  },
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useHistory(): HistoryRecord[] {
  const records = useSyncExternalStore(subscribe, () => cache)
  return [...records].sort((a, b) => b.finishedAt - a.finishedAt)
}

export function useStats(): Stats {
  return computeStats(useHistory())
}
