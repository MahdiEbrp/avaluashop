import { noop } from './unit/support/noop'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { resetPrismaMock } from './unit/support/db'

/* Deterministic environment for every test file. */
process.env.JWT_SECRET_KEY ??= 'test-secret-key-that-is-at-least-32-chars-long'
process.env.OTP_PEPPER ??= 'test-otp-pepper-that-is-at-least-32-characters'
process.env.DATABASE_URL ??= 'postgresql://shop:shop@127.0.0.1:5432/avaluashop'
process.env.NEXT_PUBLIC_URL ??= 'http://localhost:3000'

afterEach(() => {
   /* Re-arm the database double between tests: `clearAllMocks` keeps resolved
      values, so a stub left behind by one test silently changed the outcome of
      the next one. */
   resetPrismaMock()
   cleanup()
   globalThis.localStorage?.clear()
   globalThis.sessionStorage?.clear()
   vi.clearAllMocks()
   vi.restoreAllMocks()
   vi.useRealTimers()
})

/* jsdom implements neither of these, and several components reach for them. */
if (!globalThis.matchMedia) {
   Object.defineProperty(globalThis, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
         matches: false,
         media: query,
         onchange: null,
         addListener: noop,
         removeListener: noop,
         addEventListener: noop,
         removeEventListener: noop,
         dispatchEvent: () => false,
      }),
   })
}

if (!globalThis.ResizeObserver) {
   globalThis.ResizeObserver = class {
      observe = noop
      unobserve = noop
      disconnect = noop
   }
}

if (typeof Element !== 'undefined') {
   if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = noop
   }

   if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false
      Element.prototype.releasePointerCapture = noop
   }
}

if (!globalThis.IntersectionObserver) {
   globalThis.IntersectionObserver = class {
      observe = noop
      unobserve = noop
      disconnect = noop
      takeRecords() {
         return []
      }
      root = null
      rootMargin = ''
      thresholds = []
   } as unknown as typeof IntersectionObserver
}

/* Radix emits these during pointer interactions. */
if (!globalThis.DOMRect) {
   globalThis.DOMRect = {
      fromRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
   } as unknown as typeof DOMRect
}
