import { AVATAR_MAX_CHARS, AVATAR_SIZE_PX } from '@jamez/core'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

/** Pick a library photo and downscale it to a tiny webp/jpeg data URL. */
export async function pickAndDownscaleProfilePhoto(): Promise<string | undefined> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Photo library access is needed to set a profile photo')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  })
  if (result.canceled || !result.assets[0]) return undefined

  const uri = result.assets[0].uri
  const resize = [{ resize: { width: AVATAR_SIZE_PX, height: AVATAR_SIZE_PX } }]

  const webp = await ImageManipulator.manipulateAsync(uri, resize, {
    compress: 0.82,
    format: ImageManipulator.SaveFormat.WEBP,
    base64: true,
  })
  if (webp.base64) {
    const dataUrl = `data:image/webp;base64,${webp.base64}`
    if (dataUrl.length <= AVATAR_MAX_CHARS) return dataUrl
  }

  for (const compress of [0.82, 0.55]) {
    const jpeg = await ImageManipulator.manipulateAsync(uri, resize, {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    })
    if (!jpeg.base64) continue
    const dataUrl = `data:image/jpeg;base64,${jpeg.base64}`
    if (dataUrl.length <= AVATAR_MAX_CHARS) return dataUrl
  }

  throw new Error('Could not shrink that photo enough — try a simpler image')
}
