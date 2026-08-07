import { describe, expect, it } from 'vitest'
import { normalizeAvatarPhoto, stripPlayerPhotos } from './avatar'

const TINY =
  'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='

describe('normalizeAvatarPhoto', () => {
  it('accepts small webp/jpeg data URLs', () => {
    expect(normalizeAvatarPhoto(TINY)).toBe(TINY)
    expect(
      normalizeAvatarPhoto(
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
      ),
    ).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('rejects empty, oversized, or non-image payloads', () => {
    expect(normalizeAvatarPhoto(undefined)).toBeUndefined()
    expect(normalizeAvatarPhoto('')).toBeUndefined()
    expect(normalizeAvatarPhoto('https://example.com/a.png')).toBeUndefined()
    expect(normalizeAvatarPhoto('data:image/png;base64,AAAA')).toBeUndefined()
    expect(normalizeAvatarPhoto(`data:image/webp;base64,${'A'.repeat(20_000)}`)).toBeUndefined()
  })
})

describe('stripPlayerPhotos', () => {
  it('removes photo bytes but keeps hasPhoto for the wire', () => {
    const stripped = stripPlayerPhotos({
      rev: 1,
      players: [
        { id: 'a', photo: TINY, hasPhoto: true },
        { id: 'b', emoji: '🎲' },
      ],
    })
    expect(stripped.players[0]).toEqual({ id: 'a', hasPhoto: true })
    expect(stripped.players[1]).toEqual({ id: 'b', emoji: '🎲', hasPhoto: false })
    expect(stripped.rev).toBe(1)
  })
})
