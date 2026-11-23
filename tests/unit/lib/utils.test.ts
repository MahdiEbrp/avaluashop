import { z } from 'zod'

import {
   absoluteUrl,
   cn,
   formatter,
   formatDate,
   getErrorResponse,
   isMacOs,
   isVariableValid,
   validateBoolean,
} from '@/lib/utils'

describe('cn', () => {
   it('merges conflicting tailwind classes, last wins', () => {
      expect(cn('p-2', 'p-5')).toBe('p-5')
      expect(cn('text-sm', false, undefined, 'font-bold')).toBe(
         'text-sm font-bold'
      )
   })

   it('accepts arrays and objects', () => {
      expect(cn(['p-1', 'm-1'], { hidden: false, block: true })).toBe(
         'p-1 m-1 block'
      )
   })
})

describe('formatDate', () => {
   it('formats an ISO string', () => {
      expect(formatDate('2024-03-05T00:00:00Z')).toMatch(/2024/)
      expect(formatDate('2024-03-05T00:00:00Z')).toContain('March')
   })

   it('formats a timestamp', () => {
      expect(formatDate(0)).toContain('1970')
   })
})

describe('absoluteUrl', () => {
   it('prefixes the configured app url', () => {
      const previous = process.env.NEXT_PUBLIC_APP_URL
      process.env.NEXT_PUBLIC_APP_URL = 'https://shop.example'

      expect(absoluteUrl('/cart')).toBe('https://shop.example/cart')

      process.env.NEXT_PUBLIC_APP_URL = previous
   })
})

describe('isVariableValid', () => {
   it.each([
      [0, true],
      ['', true],
      [false, true],
      [null, false],
      [undefined, false],
      [{}, true],
   ])('isVariableValid(%s) is %s', (value, expected) => {
      expect(isVariableValid(value)).toBe(expected)
   })
})

describe('validateBoolean', () => {
   it('is true only when the variable exists and matches', () => {
      expect(validateBoolean(true, true)).toBe(true)
      expect(validateBoolean(false, false)).toBe(true)
      expect(validateBoolean(true, false)).toBe(false)
      expect(validateBoolean(undefined, false)).toBe(false)
      expect(validateBoolean(null, false)).toBe(false)
   })
})

describe('isMacOs', () => {
   it('detects the platform from the user agent', () => {
      const original = globalThis.navigator.userAgent
      Object.defineProperty(globalThis.navigator, 'userAgent', {
         configurable: true,
         value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      })
      expect(isMacOs()).toBe(true)

      Object.defineProperty(globalThis.navigator, 'userAgent', {
         configurable: true,
         value: 'Mozilla/5.0 (X11; Linux x86_64)',
      })
      expect(isMacOs()).toBe(false)

      Object.defineProperty(globalThis.navigator, 'userAgent', {
         configurable: true,
         value: original,
      })
   })
})

describe('getErrorResponse', () => {
   it('labels 4xx as fail', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      const response = getErrorResponse(404, 'NOT FOUND')

      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toBe('application/json')
      await expect(response.json()).resolves.toEqual({
         status: 'fail',
         message: 'NOT FOUND',
         errors: null,
      })
   })

   it('labels 5xx as error and defaults to 500', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      const response = getErrorResponse(undefined, 'BOOM')

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ status: 'error' })
   })

   it('flattens validation errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {/* noop */ })

      const schema = z.object({ email: z.string().email(), age: z.number() })
      const parsed = schema.safeParse({ email: 'nope', age: 'old' })

      const response = getErrorResponse(422, 'INVALID', parsed.error)
      const body = (await response.json()) as {
         errors: { fieldErrors: Record<string, string[]> }
      }

      expect(body.errors.fieldErrors.email.length).toBeGreaterThan(0)
      expect(body.errors.fieldErrors.age.length).toBeGreaterThan(0)
   })
})

describe('formatter', () => {
   it('renders USD currency', () => {
      expect(formatter.format(12.5)).toBe('$12.50')
   })
})
