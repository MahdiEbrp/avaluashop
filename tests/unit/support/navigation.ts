import { vi } from 'vitest'

/**
 * `next/navigation` and `next/router` doubles. `redirect` and `notFound` throw
 * the same sentinel errors the framework throws, so control flow in the code
 * under test behaves exactly as it does in production.
 */
export class RedirectError extends Error {
   constructor(public readonly url: string) {
      super(`NEXT_REDIRECT:${url}`)
      this.name = 'RedirectError'
   }
}

export class NotFoundError extends Error {
   constructor() {
      super('NEXT_NOT_FOUND')
      this.name = 'NotFoundError'
   }
}

export const redirect = vi.fn((url: string) => {
   throw new RedirectError(url)
})
export const permanentRedirect = vi.fn((url: string) => {
   throw new RedirectError(url)
})
export const notFound = vi.fn(() => {
   throw new NotFoundError()
})
export const forbidden = vi.fn(() => {
   throw new Error('NEXT_FORBIDDEN')
})
export const unauthorized = vi.fn(() => {
   throw new Error('NEXT_UNAUTHORIZED')
})
export const useRouter = vi.fn(() => routerMock)
export const usePathname = vi.fn(() => '/')
export const useSearchParams = vi.fn(() => new URLSearchParams())
export const useParams = vi.fn(() => ({}))
export const useSelectedLayoutSegment = vi.fn(() => null)
export const useSelectedLayoutSegments = vi.fn(() => [])
export const refresh = vi.fn()

export const routerMock = {
   push: vi.fn(),
   replace: vi.fn(),
   refresh: vi.fn(),
   back: vi.fn(),
   forward: vi.fn(),
   prefetch: vi.fn(),
}

export function resetNavigationMock() {
   routerMock.push.mockClear()
   routerMock.replace.mockClear()
   routerMock.refresh.mockClear()
   routerMock.back.mockClear()
   routerMock.forward.mockClear()
   routerMock.prefetch.mockClear()
   redirect.mockClear()
   notFound.mockClear()
}
