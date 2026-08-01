import {
  computeStats,
  type HistoryRecord,
  type HistoryStore,
  type Stats,
} from '@jamez/core'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'jamez.history.v1'

function read(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

let cache: HistoryRecord[] = read()
const listeners = new Set<() => void>()

function write(records: HistoryRecord[]): void {
  cache = records
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // storage full/unavailable — history stays in memory for the session
  }
  for (const listener of listeners) listener()
}

/** localStorage-backed implementation of the core HistoryStore interface. */
export const historyStore: HistoryStore = {
  async list() {
    return [...cache].sort((a, b) => b.finishedAt - a.finishedAt)
  },
  async save(record) {
    write([...cache.filter((r) => r.id !== record.id), record])
  },
  async remove(id) {
    write(cache.filter((r) => r.id !== id))
  },
  async clear() {
    write([])
  },
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useHistory(): HistoryRecord[] {
  const records = useSyncExternalStore(subscribe, () => cache)
  return [...records].sort((a, b) => b.finishedAt - a.finishedAt)
}

export function useStats(): Stats {
  const records = useHistory()
  return computeStats(records)
}
