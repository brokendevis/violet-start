import assert from 'node:assert/strict'
import test from 'node:test'
import { defaults, encodeBackup, maxBackupBytes, parseSettings, parseWallpaper, writeSettings } from '../src/settings.ts'

test('backup preserves the quote, group order, selected engine and wallpaper', () => {
  const settings = defaults()
  settings.quote = 'A custom\nquote.'
  settings.groups.reverse()
  settings.provider = 'yandex'
  settings.wallpaper = { kind: 'preset', id: 'eclipse' }
  assert.deepEqual(parseSettings(JSON.parse(encodeBackup(settings))), settings)
})

test('backup limit counts UTF-8 bytes', () => {
  const settings = defaults()
  settings.quote = 'я'.repeat(maxBackupBytes / 2)
  assert.throws(() => encodeBackup(settings), /5 MiB/)
})

test('confirmed replacement restores corrupted settings under the same lock', async (t) => {
  let saved: unknown = { version: 999 }
  let lockHeld = false
  Object.defineProperty(globalThis, 'browser', { configurable: true, value: {
    storage: { local: {
      get: async () => ({ settings: saved }),
      set: async (values: { settings: unknown }) => {
        assert.ok(lockHeld)
        saved = values.settings
      },
    } },
  } })
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (name: string, action: () => Promise<unknown>) => {
      assert.equal(name, 'violet-start-settings')
      lockHeld = true
      try { return await action() } finally { lockHeld = false }
    },
  } })
  t.after(() => {
    Reflect.deleteProperty(globalThis, 'browser')
    Reflect.deleteProperty(navigator, 'locks')
  })
  await assert.rejects(writeSettings(current => ({ ...current, quote: 'Edited' })), /version/)
  assert.deepEqual(saved, { version: 999 })
  const backup = { ...defaults(), quote: 'Recovered' }
  assert.deepEqual(await writeSettings(backup), backup)
  assert.deepEqual(saved, backup)
})

test('unknown version, engine, duplicate IDs and dangerous links are rejected', () => {
  const settings = defaults()
  assert.throws(() => parseSettings({ ...settings, version: 2 }), /version/)
  assert.throws(() => parseSettings({ ...settings, provider: 'custom' }), /engine/)
  settings.groups[0].links[0].url = 'javascript:alert(1)'
  assert.throws(() => parseSettings(settings), /HTTPS/)
  settings.groups[0].links[0].url = 'https://example.org/'
  settings.groups[0].links[0].id = settings.groups[0].id
  assert.throws(() => parseSettings(settings), /Duplicate/)
})

test('wallpapers accept only known presets and bounded raster data URLs', () => {
  assert.throws(() => parseWallpaper({ kind: 'preset', id: '../elsewhere' }), /wallpaper/)
  assert.throws(() => parseWallpaper({ kind: 'custom', dataUrl: 'https://example.org/image.png' }), /wallpaper/)
  assert.throws(() => parseWallpaper({ kind: 'custom', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }), /wallpaper/)
  assert.throws(() => parseWallpaper({ kind: 'custom', dataUrl: 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024) }), /2 MiB/)
})
