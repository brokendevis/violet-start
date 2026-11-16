import assert from 'node:assert/strict'
import test from 'node:test'
import { isProvider, searchUrl } from '../src/search.ts'

test('search only accepts the four built-in engines', () => {
  for (const engine of ['firefox', 'google', 'yandex', 'duckduckgo']) assert.ok(isProvider(engine))
  assert.equal(isProvider('__proto__'), false)
  assert.equal(isProvider('https://example.com'), false)
})

test('Unicode and delimiters stay inside the query parameter', () => {
  const query = 'поиск #x &q=other + ?'
  for (const [engine, origin, param] of [
    ['google', 'https://www.google.com', 'q'],
    ['yandex', 'https://ya.ru', 'text'],
    ['duckduckgo', 'https://duckduckgo.com', 'q'],
  ] as const) {
    const url = new URL(searchUrl(engine, query))
    assert.equal(url.origin, origin)
    assert.deepEqual([...url.searchParams], [[param, query]])
    assert.equal(url.hash, '')
  }
})
