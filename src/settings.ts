import { defaultGroups, defaultQuote, type Group, type Link } from './defaults.ts'
import { isProvider, type Provider } from './search.ts'

export const settingsKey = 'settings'
export const wallpapers = { shadow: 'Shadow', raven: 'Raven', eclipse: 'Eclipse' } as const
type Preset = keyof typeof wallpapers
export type Wallpaper = { kind: 'preset'; id: Preset } | { kind: 'custom'; dataUrl: string }

export interface Settings {
  version: 1
  quote: string
  groups: Group[]
  provider: Provider
  wallpaper: Wallpaper
}

export const maxImageBytes = 2 * 1024 * 1024
export const maxBackupBytes = 5 * 1024 * 1024

export function defaults(): Settings {
  return {
    version: 1,
    quote: defaultQuote,
    groups: structuredClone(defaultGroups),
    provider: 'firefox',
    wallpaper: { kind: 'preset', id: 'shadow' },
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid settings format.')
  }
  return value as Record<string, unknown>
}

function required(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`)
  return value.trim()
}

function httpUrl(value: unknown) {
  const address = required(value, 'Link URL')
  try {
    const url = new URL(address)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href
  } catch {
    // Incomplete addresses get the same actionable message as other schemes.
  }
  throw new Error('Links must use an absolute HTTP or HTTPS URL.')
}

function parseGroups(value: unknown): Group[] {
  if (!Array.isArray(value)) throw new Error('Invalid groups.')
  const ids = new Set<string>()
  function uniqueId(value: unknown) {
    const id = required(value, 'ID')
    if (ids.has(id)) throw new Error('Duplicate group or link ID.')
    ids.add(id)
    return id
  }
  return value.map((group: unknown) => {
    const { id, name, links } = record(group)
    if (!Array.isArray(links)) throw new Error('Invalid links.')
    return {
      id: uniqueId(id),
      name: required(name, 'Group name'),
      links: links.map((link: unknown): Link => {
        const { id, title, url } = record(link)
        return { id: uniqueId(id), title: required(title, 'Link title'), url: httpUrl(url) }
      }),
    }
  })
}

export function parseWallpaper(value: unknown): Wallpaper {
  const { kind, id, dataUrl } = record(value)
  if (kind === 'preset' && typeof id === 'string' && Object.hasOwn(wallpapers, id)) {
    return { kind, id: id as Preset }
  }
  if (kind === 'custom' && typeof dataUrl === 'string' &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) {
    const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1)
    if (encoded.length > Math.ceil(maxImageBytes / 3) * 4 || atob(encoded).length > maxImageBytes) {
      throw new Error('Wallpaper is larger than 2 MiB.')
    }
    return { kind, dataUrl }
  }
  throw new Error('Choose a built-in wallpaper or a PNG, JPEG or WebP file.')
}

export function parseSettings(value: unknown): Settings {
  const { version, quote, groups, provider, wallpaper } = record(value)
  if (version !== 1) throw new Error('Unsupported settings version.')
  if (typeof quote !== 'string') throw new Error('Invalid quote.')
  if (!isProvider(provider)) throw new Error('Unknown search engine.')
  return { version, quote, groups: parseGroups(groups), provider, wallpaper: parseWallpaper(wallpaper) }
}

export function editableContent(settings: Settings) {
  const { quote, groups, wallpaper } = settings
  return { quote, groups, wallpaper }
}

export async function readSettings() {
  const stored = (await browser.storage.local.get(settingsKey))[settingsKey]
  return stored === undefined ? defaults() : parseSettings(stored)
}

export async function writeSettings(update: (current: Settings) => Settings) {
  return navigator.locks.request('violet-start-settings', async () => {
    const next = parseSettings(update(await readSettings()))
    await browser.storage.local.set({ [settingsKey]: next })
    return next
  })
}

export function wallpaperUrl(wallpaper: Wallpaper) {
  return wallpaper.kind === 'custom' ? wallpaper.dataUrl : `wallpapers/${wallpaper.id}.webp`
}

export async function checkWallpaper(wallpaper: Wallpaper) {
  if (wallpaper.kind === 'preset') return
  const image = new Image()
  image.src = wallpaper.dataUrl
  try {
    await image.decode()
  } catch {
    throw new Error('This wallpaper could not be decoded.')
  }
}

export async function readWallpaper(file: File) {
  if (file.size > maxImageBytes) throw new Error('Wallpaper is larger than 2 MiB.')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the wallpaper.'))
    reader.readAsDataURL(file)
  })
  const wallpaper = parseWallpaper({ kind: 'custom', dataUrl })
  await checkWallpaper(wallpaper)
  return wallpaper
}
