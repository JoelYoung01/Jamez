import { AVATAR_MAX_CHARS, AVATAR_SIZE_PX } from '@jamez/core'

/** Downscale a local image file to a tiny webp/jpeg data URL for profile sync. */
export async function downscaleImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file')
  }
  const bitmap = await createImageBitmap(file)
  try {
    const size = AVATAR_SIZE_PX
    const scale = Math.max(size / bitmap.width, size / bitmap.height)
    const sw = size / scale
    const sh = size / scale
    const sx = (bitmap.width - sw) / 2
    const sy = (bitmap.height - sh) / 2

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process image')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, size, size)

    let dataUrl = canvas.toDataURL('image/webp', 0.82)
    if (!dataUrl.startsWith('data:image/webp') || dataUrl.length > AVATAR_MAX_CHARS) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    }
    if (dataUrl.length > AVATAR_MAX_CHARS) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.65)
    }
    if (dataUrl.length > AVATAR_MAX_CHARS) {
      throw new Error('Could not shrink that photo enough — try a simpler image')
    }
    return dataUrl
  } finally {
    bitmap.close()
  }
}
