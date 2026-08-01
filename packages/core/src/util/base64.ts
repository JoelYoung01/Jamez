// Hand-rolled base64 so the same code runs in browsers, React Native (Hermes),
// and Node without relying on btoa/atob or Buffer being present.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const LOOKUP: Record<string, number> = {}
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET[i]!] = i

export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0
    out += ALPHABET[b0 >> 2]!
    out += ALPHABET[((b0 & 3) << 4) | (b1 >> 4)]!
    out += i + 1 < bytes.length ? ALPHABET[((b1 & 15) << 2) | (b2 >> 6)]! : '='
    out += i + 2 < bytes.length ? ALPHABET[b2 & 63]! : '='
  }
  return out
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
  const len = Math.floor((clean.length * 3) / 4)
  const out = new Uint8Array(len)
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const n0 = LOOKUP[clean[i] ?? 'A'] ?? 0
    const n1 = LOOKUP[clean[i + 1] ?? 'A'] ?? 0
    const n2 = LOOKUP[clean[i + 2] ?? 'A'] ?? 0
    const n3 = LOOKUP[clean[i + 3] ?? 'A'] ?? 0
    if (o < len) out[o++] = (n0 << 2) | (n1 >> 4)
    if (o < len) out[o++] = ((n1 & 15) << 4) | (n2 >> 2)
    if (o < len) out[o++] = ((n2 & 3) << 6) | n3
  }
  return out
}
