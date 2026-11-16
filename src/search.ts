export const providers = {
  firefox: { label: 'Firefox default', short: 'Fx' },
  google: { label: 'Google', short: 'G', address: 'https://www.google.com/search', parameter: 'q' },
  yandex: { label: 'Yandex', short: 'Я', address: 'https://ya.ru/search/', parameter: 'text' },
  duckduckgo: {
    label: 'DuckDuckGo',
    short: 'DDG',
    address: 'https://duckduckgo.com/',
    parameter: 'q',
  },
} as const

export type Provider = keyof typeof providers

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && Object.hasOwn(providers, value)
}

export function searchUrl(provider: Exclude<Provider, 'firefox'>, query: string) {
  const { address, parameter } = providers[provider]
  const url = new URL(address)
  url.searchParams.set(parameter, query)
  return url.href
}
