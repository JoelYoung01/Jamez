import { describe, expect, it } from 'vitest'
import { deriveRoomKey, open, roomAad, roomTopic, seal } from './crypto'
import { generateKeypair, signEvent, verifyEvent } from './nostr-event'

describe('room crypto', () => {
  it('round-trips payloads', () => {
    const key = deriveRoomKey('ABC234')
    const aad = roomAad('ABC234')
    const payload = { hello: 'world', nested: { n: 42, list: [1, 2, 3] } }
    const sealed = seal(key, payload, aad)
    expect(typeof sealed).toBe('string')
    expect(open(key, sealed, aad)).toEqual(payload)
  })

  it('is case-insensitive on the join code', () => {
    const sealed = seal(deriveRoomKey('abc234'), { ok: true }, roomAad('abc234'))
    expect(open(deriveRoomKey('ABC234'), sealed, roomAad('ABC234'))).toEqual({ ok: true })
  })

  it('rejects wrong keys, wrong aad, and tampered ciphertext', () => {
    const key = deriveRoomKey('ABC234')
    const aad = roomAad('ABC234')
    const sealed = seal(key, { secret: 1 }, aad)
    expect(open(deriveRoomKey('XYZ789'), sealed, aad)).toBeNull()
    expect(open(key, sealed, roomAad('XYZ789'))).toBeNull()
    const tampered = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(open(key, tampered, aad)).toBeNull()
  })

  it('derives distinct topics per code without revealing the code', () => {
    const topic = roomTopic('ABC234')
    expect(topic).toHaveLength(32)
    expect(topic).not.toContain('ABC234')
    expect(roomTopic('ABD234')).not.toBe(topic)
  })
})

describe('nostr events', () => {
  it('signs and verifies', () => {
    const keypair = generateKeypair()
    const event = signEvent(keypair, { kind: 20808, tags: [['t', 'topic']], content: 'hi' })
    expect(verifyEvent(event)).toBe(true)
  })

  it('detects tampering', () => {
    const keypair = generateKeypair()
    const event = signEvent(keypair, { kind: 20808, tags: [], content: 'hi' })
    expect(verifyEvent({ ...event, content: 'bye' })).toBe(false)
    expect(verifyEvent({ ...event, created_at: event.created_at + 1 })).toBe(false)
  })
})
