import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes, bytesToHex, randomBytes } from '@noble/hashes/utils.js'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { bytesToBase64, base64ToBytes } from '../util/base64'

const KEY_SALT = utf8ToBytes('jamez/v1/room-key')
const KEY_INFO = utf8ToBytes('jamez-room')
const NONCE_LENGTH = 24

/**
 * Every session is end-to-end encrypted with a key derived from the join
 * code. The code never travels through the relays, so relays (public or
 * self-hosted) only ever see ciphertext tagged with an opaque topic hash.
 */
export function deriveRoomKey(code: string): Uint8Array {
  return hkdf(sha256, utf8ToBytes(code.toUpperCase()), KEY_SALT, KEY_INFO, 32)
}

/** Opaque room identifier safe to expose to relays (does not reveal the code). */
export function roomTopic(code: string): string {
  return bytesToHex(sha256(utf8ToBytes('jamez/v1/topic:' + code.toUpperCase()))).slice(0, 32)
}

export function roomAad(code: string): Uint8Array {
  return utf8ToBytes('jamez/v1/aad:' + roomTopic(code))
}

/** Encrypt a JSON-serializable value -> base64(nonce || ciphertext). */
export function seal(key: Uint8Array, value: unknown, aad: Uint8Array): string {
  const nonce = randomBytes(NONCE_LENGTH)
  const cipher = xchacha20poly1305(key, nonce, aad)
  const ciphertext = cipher.encrypt(utf8ToBytes(JSON.stringify(value)))
  const combined = new Uint8Array(nonce.length + ciphertext.length)
  combined.set(nonce, 0)
  combined.set(ciphertext, nonce.length)
  return bytesToBase64(combined)
}

/** Decrypt base64(nonce || ciphertext) -> parsed JSON, or null if invalid. */
export function open(key: Uint8Array, sealed: string, aad: Uint8Array): unknown | null {
  try {
    const combined = base64ToBytes(sealed)
    if (combined.length <= NONCE_LENGTH) return null
    const nonce = combined.slice(0, NONCE_LENGTH)
    const ciphertext = combined.slice(NONCE_LENGTH)
    const cipher = xchacha20poly1305(key, nonce, aad)
    const plaintext = cipher.decrypt(ciphertext)
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown
  } catch {
    return null
  }
}
