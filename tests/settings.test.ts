import assert from 'node:assert/strict'
import test from 'node:test'
import { defaults, parseSettings, parseWallpaper } from '../src/settings.ts'

test('backup preserves the quote, group order, selected engine and wallpaper', () => {
  const settings = defaults()
  settings.quote = 'A custom\nquote.'
  settings.groups.reverse()
  settings.provider = 'yandex'
  settings.wallpaper = { kind: 'preset', id: 'eclipse' }
  assert.deepEqual(parseSettings(JSON.parse(JSON.stringify(settings))), settings)
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
