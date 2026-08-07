/**
 * Tiny inline avatars (data-URL webp/jpeg) travel via hello / avatar messages,
 * not every session state broadcast. Keep them small enough for relay events.
 */

/** Max data-URL character length (~12KB binary after base64 overhead). */
export const AVATAR_MAX_CHARS = 16_000

/** Target edge length in CSS pixels when downscaling on the client. */
export const AVATAR_SIZE_PX = 64

const AVATAR_DATA_URL_RE = /^data:image\/(webp|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/i

/** Return a sanitized data-URL photo, or undefined if missing/invalid/too large. */
export function normalizeAvatarPhoto(photo: string | undefined | null): string | undefined {
  if (photo == null) return undefined
  if (typeof photo !== 'string') return undefined
  const trimmed = photo.trim()
  if (!trimmed) return undefined
  if (trimmed.length > AVATAR_MAX_CHARS) return undefined
  if (!AVATAR_DATA_URL_RE.test(trimmed)) return undefined
  return trimmed
}

/** Clone session state without embedding photo bytes on players (for the wire). */
export function stripPlayerPhotos<T extends { players: Array<{ photo?: string; hasPhoto?: boolean }> }>(
  state: T,
): T {
  return {
    ...state,
    players: state.players.map((p) => {
      const hasPhoto = Boolean(p.photo) || p.hasPhoto === true
      if (!('photo' in p) || p.photo === undefined) {
        return hasPhoto === p.hasPhoto ? p : { ...p, hasPhoto }
      }
      const { photo: _photo, ...rest } = p
      return { ...rest, hasPhoto }
    }),
  }
}
