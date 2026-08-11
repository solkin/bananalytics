/* App icons are stored exactly as they arrive, so the browser normalizes them
   first: a center-cropped square PNG keeps every uploaded logo the same shape
   as the slot it renders in, and a few kilobytes rather than a few megabytes. */

/** Icons render at 44px at most, so this survives any display density. */
const MAX_SIDE = 256

export const ICON_ACCEPT = 'image/png,image/jpeg,image/webp'

/** Rejects anything the browser cannot decode as an image. */
export async function squareIconPng(file: File): Promise<Blob> {
  // `accept` on the picker is a hint, not a guarantee — a renamed file reaches
  // here and must fail with something the user can act on.
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Choose a PNG, JPEG or WebP image')
  })
  try {
    const crop = Math.min(bitmap.width, bitmap.height)
    // Never upscale: a 48px launcher icon stays crisp at its own size.
    const side = Math.min(MAX_SIDE, crop)

    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is unavailable')

    ctx.drawImage(
      bitmap,
      (bitmap.width - crop) / 2,
      (bitmap.height - crop) / 2,
      crop,
      crop,
      0,
      0,
      side,
      side,
    )

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to read the image'))),
        'image/png',
      )
    })
  } finally {
    bitmap.close()
  }
}
