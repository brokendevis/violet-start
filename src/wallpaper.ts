import { z } from 'zod'

export const wallpapers = { shadow: 'Shadow', raven: 'Raven', eclipse: 'Eclipse' } as const
const invalidWallpaper = 'Choose a built-in wallpaper or a PNG, JPEG or WebP file.'
const maxImageBytes = 2 * 1024 * 1024
const maxWallpaperPixels = 24_000_000

const presetId = z.custom<keyof typeof wallpapers>(
  (id) => typeof id === 'string' && Object.hasOwn(wallpapers, id),
  invalidWallpaper,
)

const imageData = z.string().superRefine((dataUrl, ctx) => {
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) {
    ctx.addIssue({ code: 'custom', message: invalidWallpaper })
    return
  }
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1)
  try {
    if (encoded.length > Math.ceil(maxImageBytes / 3) * 4 || atob(encoded).length > maxImageBytes) {
      ctx.addIssue({ code: 'custom', message: 'Wallpaper is larger than 2 MiB.' })
    }
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid wallpaper data.' })
  }
})

export const wallpaperSchema = z.discriminatedUnion(
  'kind',
  [
    z.object({ kind: z.literal('preset'), id: presetId }),
    z.object({ kind: z.literal('custom'), dataUrl: imageData }),
  ],
  { error: invalidWallpaper },
)

export type Wallpaper = z.infer<typeof wallpaperSchema>

export function wallpaperUrl(wallpaper: Wallpaper) {
  return wallpaper.kind === 'custom' ? wallpaper.dataUrl : `wallpapers/${wallpaper.id}.webp`
}

export async function checkWallpaper(wallpaper: Wallpaper) {
  if (wallpaper.kind === 'preset') return
  const image = new Image()
  image.decoding = 'async'
  const decodeError = 'This wallpaper could not be decoded.'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(decodeError))
    image.src = wallpaper.dataUrl
  })
  if (image.naturalWidth * image.naturalHeight > maxWallpaperPixels) {
    throw new Error('Wallpaper exceeds 24 megapixels.')
  }
  await image.decode().catch(() => {
    throw new Error(decodeError)
  })
}

export async function readWallpaper(file: File) {
  if (file.size > maxImageBytes) throw new Error('Wallpaper is larger than 2 MiB.')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the wallpaper.'))
    reader.readAsDataURL(file)
  })
  const wallpaper = wallpaperSchema.parse({ kind: 'custom', dataUrl })
  await checkWallpaper(wallpaper)
  return wallpaper
}
