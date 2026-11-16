import { z } from 'zod'
import { defaultGroups, defaultQuote } from './defaults.ts'
import { isProvider, type Provider } from './search.ts'
import { wallpaperSchema } from './wallpaper.ts'

export const settingsKey = 'settings'
export const maxBackupBytes = 5 * 1024 * 1024

function required(field: string) {
  const error = `${field} is required.`
  return z.string({ error }).trim().min(1, error)
}

const linkUrl = required('Link URL').transform((value, ctx) => {
  const url = URL.parse(value)
  if (url && (url.protocol === 'https:' || url.protocol === 'http:')) return url.href
  ctx.addIssue({ code: 'custom', message: 'Links must use an absolute HTTP or HTTPS URL.' })
  return z.NEVER
})

const linkSchema = z.object({
  id: required('ID'),
  title: required('Link title'),
  url: linkUrl,
})

const groupSchema = z.object({
  id: required('ID'),
  name: required('Group name'),
  links: z.array(linkSchema, { error: 'Invalid links.' }),
})

const settingsSchema = z
  .object(
    {
      version: z.literal(1, { error: 'Unsupported settings version.' }),
      quote: z.string({ error: 'Invalid quote.' }),
      groups: z.array(groupSchema, { error: 'Invalid groups.' }),
      provider: z.custom<Provider>(isProvider, 'Unknown search engine.'),
      wallpaper: wallpaperSchema,
    },
    { error: 'Invalid settings format.' },
  )
  .refine(
    ({ groups }) => {
      const ids = groups.flatMap((group) => [group.id, ...group.links.map((link) => link.id)])
      return new Set(ids).size === ids.length
    },
    { path: ['groups'], message: 'Duplicate group or link ID.' },
  )

export type Settings = z.infer<typeof settingsSchema>

export function parseSettings(value: unknown): Settings {
  const result = settingsSchema.safeParse(value)
  if (!result.success)
    throw new Error(result.error.issues[0]?.message ?? 'Invalid settings format.')
  return result.data
}

export function encodeBackup(settings: Settings) {
  const json = JSON.stringify(settings)
  if (new TextEncoder().encode(json).byteLength > maxBackupBytes) {
    throw new Error('Settings exceed the 5 MiB backup limit.')
  }
  return json
}

export function defaults(): Settings {
  return {
    version: 1,
    quote: defaultQuote,
    groups: structuredClone(defaultGroups),
    provider: 'firefox',
    wallpaper: { kind: 'preset', id: 'shadow' },
  }
}

export function settingsFromStorage(stored: unknown) {
  return stored === undefined ? defaults() : parseSettings(stored)
}

export async function readSettings() {
  const stored = await browser.storage.local.get(settingsKey)
  return settingsFromStorage(stored[settingsKey])
}

export async function writeSettings(update: Settings | ((current: Settings) => Settings)) {
  return navigator.locks.request('violet-start-settings', async () => {
    const next = parseSettings(typeof update === 'function' ? update(await readSettings()) : update)
    encodeBackup(next)
    await browser.storage.local.set({ [settingsKey]: next })
    return next
  })
}
