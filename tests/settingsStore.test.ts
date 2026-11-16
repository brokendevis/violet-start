import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { createPinia } from 'pinia'
import { defaults, parseSettings } from '../src/settings.ts'
import { editableContent, useSettingsStore } from '../src/settingsStore.ts'

test('storage events beat the first read, and saves merge with current settings under the lock', async (t) => {
  const initial = defaults()
  let stored: unknown = initial
  const firstRead = Promise.withResolvers<Record<string, unknown>>()
  const get = t.mock.fn(async () => ({ settings: structuredClone(stored) }))
  get.mock.mockImplementationOnce(() => firstRead.promise)
  let queued = Promise.resolve()
  let listener: ((changes: Record<string, { newValue: unknown }>, area: string) => void) | undefined

  Object.defineProperty(globalThis, 'browser', {
    configurable: true,
    value: {
      storage: {
        local: {
          get,
          set: async ({ settings }: { settings: unknown }) => {
            stored = structuredClone(settings)
            listener?.({ settings: { newValue: stored } }, 'local')
          },
        },
        onChanged: {
          addListener: (callback: typeof listener) => {
            listener = callback
          },
          removeListener: (callback: typeof listener) => {
            assert.equal(listener, callback)
            listener = undefined
          },
        },
      },
    },
  })
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (name: string, action: () => Promise<unknown>) => {
        assert.equal(name, 'violet-start-settings')
        const result = queued.then(action)
        queued = result.then(
          () => undefined,
          () => undefined,
        )
        return result
      },
    },
  })
  t.after(() => {
    Reflect.deleteProperty(globalThis, 'browser')
    Reflect.deleteProperty(navigator, 'locks')
  })

  const store = useSettingsStore(createPinia())
  const stop = store.startSync()
  assert.equal(store.loadState, 'loading')
  stored = { ...initial, quote: 'Newer quote' }
  listener?.({ settings: { newValue: stored } }, 'local')
  firstRead.resolve({ settings: initial })
  await setImmediate()
  assert.equal(store.loadState, 'ready')
  assert.equal(store.settings.quote, 'Newer quote')

  const edit = editableContent(store.settings)
  const baseline = JSON.stringify(edit)
  await Promise.all([
    store.chooseProvider('yandex'),
    store.saveEdits({ ...edit, quote: 'Saved quote' }, baseline),
  ])
  assert.equal(parseSettings(stored).provider, 'yandex')
  assert.equal(store.settings.quote, 'Saved quote')
  await assert.rejects(store.saveEdits(edit, baseline), /Another tab/)

  const freshEdit = editableContent(store.settings)
  await Promise.all([
    store.saveEdits(
      { ...freshEdit, quote: 'Saved before provider change' },
      JSON.stringify(freshEdit),
    ),
    store.chooseProvider('duckduckgo'),
  ])
  assert.equal(store.settings.quote, 'Saved before provider change')
  assert.equal(store.settings.provider, 'duckduckgo')

  const beforeInvalidRestore = stored
  const badBackup = {
    ...initial,
    groups: [
      {
        id: 'one',
        name: 'Test',
        links: [{ id: 'two', title: 'Invalid', url: 'javascript:alert(1)' }],
      },
    ],
  }
  await assert.rejects(store.restore(badBackup), /HTTPS/)
  assert.deepEqual(stored, beforeInvalidRestore)

  stored = { version: 999 }
  listener?.({ settings: { newValue: stored } }, 'local')
  assert.equal(store.loadState, 'invalid')
  await store.restore(initial)
  assert.deepEqual(stored, initial)
  assert.equal(store.loadState, 'ready')
  stop()
  assert.equal(listener, undefined)
})
