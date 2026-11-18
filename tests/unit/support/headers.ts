import { vi } from 'vitest'

/** `next/headers`: cookies() and headers() as async request-scoped doubles. */
export interface CookieJar {
   get: (name: string) => { name: string; value: string } | undefined
   getAll: () => { name: string; value: string }[]
   has: (name: string) => boolean
   set: ReturnType<typeof vi.fn>
   delete: ReturnType<typeof vi.fn>
   toString: () => string
}

export function createCookieJar(initial: Record<string, string> = {}): CookieJar {
   const jar = new Map(Object.entries(initial))

   return {
      get: (name: string) =>
         jar.has(name) ? { name, value: jar.get(name) as string } : undefined,
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      has: (name: string) => jar.has(name),
      set: vi.fn((name: string, value: string) => {
         jar.set(name, value)
      }),
      delete: vi.fn((name: string) => {
         jar.delete(name)
         return true
      }),
      toString: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
   }
}

export const headersState = { value: new Map<string, string>() }

export const cookies = vi.fn(async () => currentCookies)

export const headers = vi.fn(async () => ({
   get: (name: string) => headersState.value.get(name.toLowerCase()) ?? null,
   has: (name: string) => headersState.value.has(name.toLowerCase()),
   entries: () => headersState.value.entries(),
   keys: () => headersState.value.keys(),
   values: () => headersState.value.values(),
   forEach: (cb: (value: string, key: string) => void) =>
      headersState.value.forEach((value, key) => cb(value, key)),
}))

export const draftMode = vi.fn(async () => ({
   isEnabled: false,
   enable: vi.fn(),
   disable: vi.fn(),
}))

let currentCookies = createCookieJar()

export function setCookies(initial: Record<string, string> = {}) {
   currentCookies = createCookieJar(initial)
   cookies.mockImplementation(async () => currentCookies)
   return currentCookies
}

export function getCurrentCookies() {
   return currentCookies
}

export function setHeaders(initial: Record<string, string> = {}) {
   headersState.value = new Map(
      Object.entries(initial).map(([k, v]) => [k.toLowerCase(), v])
   )
}
