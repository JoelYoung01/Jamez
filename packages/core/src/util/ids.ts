/**
 * Join codes intentionally avoid characters that are easy to confuse when
 * read aloud or typed from across a table: no I, L, O, 0, or 1.
 */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const JOIN_CODE_LENGTH = 6

function randomBytes(length: number): Uint8Array {
  const cryptoObj = globalThis.crypto
  if (!cryptoObj?.getRandomValues) {
    throw new Error(
      'crypto.getRandomValues is not available. On React Native, import "react-native-get-random-values" at app startup.',
    )
  }
  const bytes = new Uint8Array(length)
  cryptoObj.getRandomValues(bytes)
  return bytes
}

/** Random lowercase hex id. Default 16 bytes = 32 chars. */
export function randomId(byteLength = 16): string {
  const bytes = randomBytes(byteLength)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function generateJoinCode(length = JOIN_CODE_LENGTH): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += JOIN_CODE_ALPHABET[bytes[i]! % JOIN_CODE_ALPHABET.length]!
  }
  return out
}

/** Uppercases and strips separators; returns '' if any character is invalid. */
export function normalizeJoinCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '')
  if (cleaned.length === 0) return ''
  for (const ch of cleaned) {
    if (!JOIN_CODE_ALPHABET.includes(ch)) return ''
  }
  return cleaned
}

export function isValidJoinCode(input: string): boolean {
  const normalized = normalizeJoinCode(input)
  return normalized.length === JOIN_CODE_LENGTH
}
