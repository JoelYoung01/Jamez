import { describe, expect, it } from 'vitest'
import {
  isOpenRoomStatus,
  normalizeRoomStatus,
  parkStatusForPhase,
  roomStatusLabel,
} from './room-status'

describe('parkStatusForPhase', () => {
  it('parks lobby as draft and in-play as inactive', () => {
    expect(parkStatusForPhase('lobby')).toBe('draft')
    expect(parkStatusForPhase('playing')).toBe('inactive')
    expect(parkStatusForPhase('finished')).toBe('inactive')
  })
})

describe('normalizeRoomStatus', () => {
  it('keeps explicit status', () => {
    expect(normalizeRoomStatus('active', 'lobby')).toBe('active')
    expect(normalizeRoomStatus('inactive', 'playing')).toBe('inactive')
  })

  it('derives legacy snapshots without promoting to active', () => {
    expect(normalizeRoomStatus(undefined, 'lobby')).toBe('draft')
    expect(normalizeRoomStatus(undefined, 'playing')).toBe('inactive')
    expect(normalizeRoomStatus(undefined, 'finished')).toBe('complete')
  })
})

describe('isOpenRoomStatus / roomStatusLabel', () => {
  it('treats draft/active/inactive as open', () => {
    expect(isOpenRoomStatus('draft')).toBe(true)
    expect(isOpenRoomStatus('active')).toBe(true)
    expect(isOpenRoomStatus('inactive')).toBe(true)
    expect(isOpenRoomStatus('complete')).toBe(false)
  })

  it('labels statuses for UI', () => {
    expect(roomStatusLabel('active')).toBe('Live')
    expect(roomStatusLabel('draft')).toBe('Draft')
    expect(roomStatusLabel('inactive')).toBe('Parked')
    expect(roomStatusLabel('complete')).toBe('Ended')
  })
})
