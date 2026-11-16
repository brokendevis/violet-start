import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Firefox opens the bundled new-tab page', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'))
  assert.equal(manifest.chrome_url_overrides.newtab, 'index.html')
})
