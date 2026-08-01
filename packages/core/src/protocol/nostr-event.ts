import { schnorr } from '@noble/curves/secp256k1.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes, bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js'

/**
 * Minimal NIP-01 event support. Jamez uses Nostr purely as a dumb,
 * interchangeable message bus: events are ephemeral (relays broadcast but do
 * not store them) and their content is opaque ciphertext.
 */

/** Ephemeral kind range is 20000-29999; relays must not store these events. */
export const JAMEZ_EVENT_KIND = 20808

export interface NostrEvent {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

export interface NostrKeypair {
  secretKey: Uint8Array
  publicKeyHex: string
}

export function generateKeypair(): NostrKeypair {
  const secretKey = randomBytes(32)
  return { secretKey, publicKeyHex: bytesToHex(schnorr.getPublicKey(secretKey)) }
}

/** Exact NIP-01 serialization used for the event id. */
export function eventId(
  pubkey: string,
  createdAt: number,
  kind: number,
  tags: string[][],
  content: string,
): string {
  const serialized = JSON.stringify([0, pubkey, createdAt, kind, tags, content])
  return bytesToHex(sha256(utf8ToBytes(serialized)))
}

export function signEvent(
  keypair: NostrKeypair,
  params: { kind: number; tags: string[][]; content: string; createdAt?: number },
): NostrEvent {
  const created_at = params.createdAt ?? Math.floor(Date.now() / 1000)
  const id = eventId(keypair.publicKeyHex, created_at, params.kind, params.tags, params.content)
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), keypair.secretKey))
  return {
    id,
    pubkey: keypair.publicKeyHex,
    created_at,
    kind: params.kind,
    tags: params.tags,
    content: params.content,
    sig,
  }
}

export function verifyEvent(event: NostrEvent): boolean {
  try {
    const expected = eventId(event.pubkey, event.created_at, event.kind, event.tags, event.content)
    if (expected !== event.id) return false
    return schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey))
  } catch {
    return false
  }
}
