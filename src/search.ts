export const providers = {
  firefox: 'Firefox default',
  google: 'Google',
  yandex: 'Yandex',
  duckduckgo: 'DuckDuckGo',
} as const

export type Provider = keyof typeof providers

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && Object.hasOwn(providers, value)
}

const destinations = {
  google: ['https://www.google.com/search', 'q'],
  yandex: ['https://ya.ru/search/', 'text'],
  duckduckgo: ['https://duckduckgo.com/', 'q'],
} as const

export function searchUrl(provider: Exclude<Provider, 'firefox'>, query: string) {
  const [address, key] = destinations[provider]
  const url = new URL(address)
  url.searchParams.set(key, query)
  return url.href
}
